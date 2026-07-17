"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/lib/types";
import { colorCategory } from "@/lib/colors";

const BULK_ADD_PLACEHOLDER = `4 Get Rekt
1 Lil Waker
2 Mount Fuji
...`;

const SET_ORDER = ["Enter the Huddle", "Legend of the Lils", "Birb & Pengu"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic"];

type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
type BulkMode = "fixed" | "dyli" | "scg";
const FLOOR_MODE_LABEL: Record<Exclude<BulkMode, "fixed">, string> = {
  dyli: "Dyli floor price",
  scg: "StarCity floor price",
};

interface Consigner {
  slug: string;
  name: string;
}

type OwnerSplitRow = { owner: string; qty: number };

// Inline owner cell — supports single owner or split across consigners
function OwnerCell({
  cardId,
  stock,
  owner,
  split,
  consigners,
  onSave,
}: {
  cardId: string;
  stock: number;
  owner: string;
  split: OwnerSplitRow[] | null;
  consigners: Consigner[];
  onSave: (cardId: string, owner?: string, ownerSplit?: OwnerSplitRow[] | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  // rows during edit: array of {owner, qty as string}
  const [rows, setRows] = useState<{ owner: string; qty: string }[]>([]);

  function startEdit() {
    if (split && split.length > 0) {
      setRows(split.map((r) => ({ owner: r.owner, qty: String(r.qty) })));
    } else {
      setRows([{ owner, qty: String(stock) }]);
    }
    setEditing(true);
  }

  function cancel() { setEditing(false); }

  function addRow() {
    const firstOther = consigners.find((c) => !rows.some((r) => r.owner === c.slug));
    setRows((prev) => [...prev, { owner: firstOther?.slug ?? consigners[0]?.slug ?? "badgy", qty: "0" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    const parsed = rows
      .map((r) => ({ owner: r.owner, qty: Number(r.qty) }))
      .filter((r) => r.qty > 0);
    if (parsed.length === 0) return;
    if (parsed.length === 1) {
      // single owner — clear split
      onSave(cardId, parsed[0].owner, null);
    } else {
      onSave(cardId, parsed[0].owner, parsed);
    }
    setEditing(false);
  }

  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalOk = total === stock;

  // Display
  if (!editing) {
    const displaySplit = split && split.length > 1 ? split : null;
    return (
      <div className="flex flex-col gap-1">
        {displaySplit ? (
          <div className="flex flex-wrap gap-1">
            {displaySplit.map((s, i) => {
              const name = consigners.find((c) => c.slug === s.owner)?.name ?? s.owner;
              return (
                <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                  {s.qty}× {name}
                </span>
              );
            })}
          </div>
        ) : (
          <select
            value={owner}
            onChange={(e) => onSave(cardId, e.target.value, null)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            {consigners.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={startEdit}
          className="text-left text-[10px] text-zinc-600 hover:text-purple-400"
        >
          {displaySplit ? "edit split" : "+ split ownership"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px]">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1">
          <select
            value={row.owner}
            onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, owner: e.target.value } : r))}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-100"
          >
            {consigners.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <input
            type="number"
            min={0}
            value={row.qty}
            onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, qty: e.target.value } : r))}
            className="w-12 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-100"
          />
          {rows.length > 1 && (
            <button onClick={() => removeRow(i)} className="text-zinc-600 hover:text-red-400 text-xs">✕</button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-0.5">
        <button onClick={addRow} className="text-[10px] text-zinc-500 hover:text-purple-400">+ add row</button>
        <span className={`ml-auto text-[10px] ${totalOk ? "text-green-500" : "text-yellow-500"}`}>
          {total}/{stock}
        </span>
        <button
          onClick={save}
          disabled={!totalOk}
          className="rounded bg-purple-600 px-2 py-0.5 text-[10px] text-white hover:bg-purple-500 disabled:bg-zinc-700"
        >
          Save
        </button>
        <button onClick={cancel} className="text-[10px] text-zinc-600 hover:text-zinc-300">Cancel</button>
      </div>
    </div>
  );
}

export default function AdminInventoryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [ownerMap, setOwnerMap] = useState<Map<string, string>>(new Map());
  const [splitMap, setSplitMap] = useState<Map<string, OwnerSplitRow[]>>(new Map());
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [set, setSet] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");
  const [colorFilter, setColorFilter] = useState("All");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  const [bulkSet, setBulkSet] = useState("All");
  const [bulkRarity, setBulkRarity] = useState("All");
  const [bulkColor, setBulkColor] = useState("All");
  const [bulkMode, setBulkMode] = useState<BulkMode>("fixed");
  const [bulkPrice, setBulkPrice] = useState("0.50");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const [bulkAddText, setBulkAddText] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkAddResult, setBulkAddResult] = useState<{
    updated: { name: string; qty: number; newStock: number }[];
    unmatched: { name: string; qty: number }[];
  } | null>(null);
  const [bulkAddError, setBulkAddError] = useState<string | null>(null);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  const [bulkSearchText, setBulkSearchText] = useState("");
  const [bulkSearchResults, setBulkSearchResults] = useState<Card[] | null>(null);
  const [bulkSearchUnmatched, setBulkSearchUnmatched] = useState<string[]>([]);
  const [bulkSearchSaving, setBulkSearchSaving] = useState<string | null>(null);
  const [bulkSearchEdits, setBulkSearchEdits] = useState<Record<string, { price: string; stock: string }>>({});

  async function refreshMarketPrices() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/admin/market-prices/refresh", { method: "POST" });
      const data = await res.json();
      setRefreshResult(`Matched ${data.dyli} Dyli and ${data.scg} SCG price(s).`);
    } catch {
      setRefreshResult("Refresh failed — try again in a moment.");
    }
    setRefreshing(false);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/admin/consigners").then((r) => r.json()),
      fetch("/api/admin/inventory/owner").then((r) => r.json()),
    ]).then(([cardsData, consData, ownersData]) => {
      setCards(cardsData.cards ?? []);
      setConsigners(consData.consigners ?? []);
      const omap = new Map<string, string>();
      const smap = new Map<string, OwnerSplitRow[]>();
      for (const row of ownersData.overrides ?? []) {
        omap.set(row.cardId, row.owner);
        if (row.ownerSplit) {
          try { smap.set(row.cardId, JSON.parse(row.ownerSplit)); } catch { /* ignore */ }
        }
      }
      setOwnerMap(omap);
      setSplitMap(smap);
      setLoading(false);
    });
  }, []);

  async function saveOwner(cardId: string, owner?: string, ownerSplit?: OwnerSplitRow[] | null) {
    // Optimistic update
    if (owner) setOwnerMap((prev) => new Map(prev).set(cardId, owner));
    setSplitMap((prev) => {
      const next = new Map(prev);
      if (ownerSplit && ownerSplit.length > 1) next.set(cardId, ownerSplit);
      else next.delete(cardId);
      return next;
    });
    await fetch("/api/admin/inventory/owner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, owner, ownerSplit: ownerSplit ?? null }),
    });
  }

  const sets = useMemo(
    () => SET_ORDER.filter((s) => cards.some((c) => c.set === s)),
    [cards]
  );
  const rarities = useMemo(
    () => RARITY_ORDER.filter((r) => cards.some((c) => c.rarity === r)),
    [cards]
  );
  const colors = useMemo(
    () =>
      Array.from(new Set(cards.map((c) => colorCategory(c)))).sort(
        (a, b) => {
          if (a === "Colorless") return 1;
          if (b === "Colorless") return -1;
          if (a === "Multi-color") return 1;
          if (b === "Multi-color") return -1;
          return a.localeCompare(b);
        }
      ),
    [cards]
  );

  const bulkMatches = useMemo(
    () =>
      cards.filter(
        (c) =>
          (bulkSet === "All" || c.set === bulkSet) &&
          (bulkRarity === "All" || c.rarity === bulkRarity) &&
          (bulkColor === "All" || colorCategory(c) === bulkColor)
      ),
    [cards, bulkSet, bulkRarity, bulkColor]
  );

  async function applyBulkUpdate() {
    if (bulkMatches.length === 0) return;
    const price = bulkMode === "fixed" ? Number(bulkPrice) : undefined;
    if (bulkMode === "fixed" && (!Number.isFinite(price) || price! < 0)) return;

    const filterDesc = `${bulkSet === "All" ? "all sets" : bulkSet}, ${bulkRarity === "All" ? "all rarities" : bulkRarity}, ${bulkColor === "All" ? "all colors" : bulkColor}`;
    const confirmMsg =
      bulkMode === "fixed"
        ? `Set price to $${price!.toFixed(2)} for ${bulkMatches.length} card(s) (${filterDesc})?`
        : `Set price to each card's current ${FLOOR_MODE_LABEL[bulkMode]} for ${bulkMatches.length} card(s) (${filterDesc})? Cards with no ${FLOOR_MODE_LABEL[bulkMode].replace(" floor price", "")} price will be skipped.`;
    if (!window.confirm(confirmMsg)) return;

    setBulkApplying(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/inventory/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set: bulkSet === "All" ? null : bulkSet,
          rarity: bulkRarity === "All" ? null : bulkRarity,
          color: bulkColor === "All" ? null : bulkColor,
          mode: bulkMode,
          price,
        }),
      });
      const data = await res.json();
      setBulkResult(
        bulkMode !== "fixed"
          ? `Updated ${data.updated} card(s), skipped ${data.skipped} (no ${FLOOR_MODE_LABEL[bulkMode].replace(" floor price", "")} price yet).`
          : `Updated ${data.updated} card(s).`
      );
      const refreshed = await fetch("/api/cards").then((r) => r.json());
      setCards(refreshed.cards ?? []);
    } catch {
      setBulkResult("Bulk update failed — try again in a moment.");
    }
    setBulkApplying(false);
  }

  async function applyBulkAdd() {
    if (!bulkAddText.trim()) return;
    setBulkAdding(true);
    setBulkAddError(null);
    setBulkAddResult(null);
    try {
      const res = await fetch("/api/admin/inventory/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulkAddText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkAddError(data.error ?? "Couldn't parse that list.");
        return;
      }
      setBulkAddResult(data);
      const refreshed = await fetch("/api/cards").then((r) => r.json());
      setCards(refreshed.cards ?? []);
      if (data.unmatched.length === 0) setBulkAddText("");
    } catch {
      setBulkAddError("Bulk add failed — try again in a moment.");
    }
    setBulkAdding(false);
  }

  function runBulkSearch() {
    const names = bulkSearchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    const matched: Card[] = [];
    const unmatched: string[] = [];
    for (const name of names) {
      const q = name.toLowerCase();
      const found = cards.find(
        (c) =>
          c.name.toLowerCase() === q ||
          c.name.toLowerCase().includes(q) ||
          q.includes(c.name.toLowerCase())
      );
      if (found) {
        if (!matched.find((c) => c.id === found.id)) matched.push(found);
      } else {
        unmatched.push(name);
      }
    }
    setBulkSearchResults(matched);
    setBulkSearchUnmatched(unmatched);
    setBulkSearchEdits({});
  }

  function getBulkSearchEdit(card: Card) {
    return bulkSearchEdits[card.id] ?? { price: String(card.price), stock: String(card.stock) };
  }

  function setBulkSearchEdit(cardId: string, field: "price" | "stock", value: string) {
    const card = cards.find((c) => c.id === cardId)!;
    setBulkSearchEdits((prev) => ({
      ...prev,
      [cardId]: { ...getBulkSearchEdit(card), [field]: value },
    }));
  }

  async function saveBulkSearchCard(card: Card) {
    const edit = getBulkSearchEdit(card);
    const price = Number(edit.price);
    const stock = Number(edit.stock);
    if (!Number.isFinite(price) || !Number.isFinite(stock) || price < 0 || stock < 0) return;
    setBulkSearchSaving(card.id);
    await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, price, stock }),
    });
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, price, stock } : c)));
    setBulkSearchSaving(null);
  }

  async function applyRestore() {
    if (!restoreFile) return;
    if (!window.confirm(`Upload "${restoreFile.name}" and restore all inventory prices/stock? This will overwrite current values for every card in the CSV.`)) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const text = await restoreFile.text();
      const res = await fetch("/api/admin/inventory/restore", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        setRestoreResult(`Error: ${data.error}`);
      } else {
        setRestoreResult(`Restored ${data.restored} card(s) successfully.${data.errors?.length ? ` (${data.errors.length} row(s) skipped — see console)` : ""}`);
        if (data.errors?.length) console.warn("[restore] skipped rows:", data.errors);
        const refreshed = await fetch("/api/cards").then((r) => r.json());
        setCards(refreshed.cards ?? []);
        setRestoreFile(null);
      }
    } catch {
      setRestoreResult("Restore failed — try again in a moment.");
    }
    setRestoring(false);
  }

  const filtered = useMemo(() => {
    const result = cards.filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) &&
        (set === "All" || c.set === set) &&
        (rarityFilter === "All" || c.rarity === rarityFilter) &&
        (colorFilter === "All" || colorCategory(c) === colorFilter) &&
        (ownerFilter === "All" || (ownerMap.get(c.id) ?? "badgy") === ownerFilter)
    );

    const sorted = [...result];
    switch (sort) {
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "stock-asc":
        sorted.sort((a, b) => a.stock - b.stock);
        break;
      case "stock-desc":
        sorted.sort((a, b) => b.stock - a.stock);
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [cards, query, set, rarityFilter, colorFilter, ownerFilter, ownerMap, sort]);

  function getEdit(card: Card) {
    return edits[card.id] ?? { price: String(card.price), stock: String(card.stock) };
  }

  function setEdit(cardId: string, field: "price" | "stock", value: string) {
    setEdits((prev) => ({
      ...prev,
      [cardId]: { ...getEdit(cards.find((c) => c.id === cardId)!), [field]: value },
    }));
  }

  async function save(card: Card) {
    const edit = getEdit(card);
    const price = Number(edit.price);
    const stock = Number(edit.stock);
    if (!Number.isFinite(price) || !Number.isFinite(stock) || price < 0 || stock < 0) return;

    setSavingId(card.id);
    await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, price, stock }),
    });
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, price, stock } : c)));
    setSavingId(null);
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">Inventory</h1>
        <div className="flex items-center gap-3">
          {refreshResult && <span className="text-xs text-zinc-500">{refreshResult}</span>}
          <Link
            href="/admin/inventory/print"
            target="_blank"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-purple-500"
          >
            Print Inventory Report
          </Link>
          <button
            onClick={refreshMarketPrices}
            disabled={refreshing}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-purple-500 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh Market Prices"}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Bulk Price Update</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Pick a set/rarity, then apply a price to just those cards — everything outside the filter is untouched.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Set</label>
            <select
              value={bulkSet}
              onChange={(e) => setBulkSet(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="All">All sets</option>
              {sets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Rarity</label>
            <select
              value={bulkRarity}
              onChange={(e) => setBulkRarity(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="All">All rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Color</label>
            <select
              value={bulkColor}
              onChange={(e) => setBulkColor(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="All">All colors</option>
              {colors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Set price to</label>
            <div className="flex rounded-full border border-zinc-700 p-0.5 text-sm">
              <button
                onClick={() => setBulkMode("fixed")}
                className={`rounded-full px-3 py-1 ${bulkMode === "fixed" ? "bg-purple-600 text-white" : "text-zinc-400"}`}
              >
                Fixed amount
              </button>
              {(["dyli", "scg"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBulkMode(mode)}
                  className={`rounded-full px-3 py-1 ${bulkMode === mode ? "bg-purple-600 text-white" : "text-zinc-400"}`}
                >
                  {FLOOR_MODE_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>
          {bulkMode === "fixed" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Price</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          )}
          <button
            onClick={applyBulkUpdate}
            disabled={bulkApplying || bulkMatches.length === 0}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {bulkApplying ? "Applying..." : `Apply to ${bulkMatches.length} card(s)`}
          </button>
        </div>
        {bulkResult && <p className="mt-3 text-sm text-zinc-400">{bulkResult}</p>}
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Bulk Add by Text</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Paste a list like &quot;4 Get Rekt&quot; (one per line) — quantities get added to whatever&apos;s
          already in stock, so don&apos;t paste the same pile twice.
        </p>
        <textarea
          value={bulkAddText}
          onChange={(e) => setBulkAddText(e.target.value)}
          placeholder={BULK_ADD_PLACEHOLDER}
          rows={6}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          onClick={applyBulkAdd}
          disabled={bulkAdding || !bulkAddText.trim()}
          className="mt-3 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {bulkAdding ? "Adding..." : "Add to Inventory"}
        </button>

        {bulkAddError && <p className="mt-3 text-sm text-red-400">{bulkAddError}</p>}

        {bulkAddResult && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-400">
                Added ({bulkAddResult.updated.length})
              </h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {bulkAddResult.updated.map((u, i) => (
                  <li key={i}>+{u.qty} {u.name} → {u.newStock} in stock</li>
                ))}
              </ul>
            </div>
            {bulkAddResult.unmatched.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-400">
                  Not Found ({bulkAddResult.unmatched.length})
                </h3>
                <ul className="space-y-1 text-sm text-zinc-300">
                  {bulkAddResult.unmatched.map((u, i) => (
                    <li key={i}>{u.qty} {u.name}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-500">Check spelling, then paste just these lines again.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">Restore from Backup</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Upload a CSV backup (emailed to you daily) to restore all prices and stock.
          Format: <code className="rounded bg-zinc-800 px-1">cardId,price,stock</code> — overwrites every card in the file.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-purple-500">
            {restoreFile ? restoreFile.name : "Choose CSV file…"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { setRestoreFile(e.target.files?.[0] ?? null); setRestoreResult(null); }}
            />
          </label>
          <button
            onClick={applyRestore}
            disabled={!restoreFile || restoring}
            className="rounded-lg bg-orange-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {restoring ? "Restoring…" : "Restore Inventory"}
          </button>
        </div>
        {restoreResult && (
          <p className={`mt-3 text-sm ${restoreResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {restoreResult}
          </p>
        )}
      </div>

      {/* Bulk Name Search */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">Bulk Card Search</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Paste card names (one per line) to pull up their current prices and stock — then edit inline and save.
        </p>
        <textarea
          value={bulkSearchText}
          onChange={(e) => { setBulkSearchText(e.target.value); setBulkSearchResults(null); }}
          placeholder={"Arches\nNyan Cat\nBinkus, Who Eats the Stars\nGet Rekt"}
          rows={5}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          onClick={runBulkSearch}
          disabled={!bulkSearchText.trim()}
          className="mt-3 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          Search
        </button>

        {bulkSearchResults !== null && (
          <div className="mt-5">
            {bulkSearchResults.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Card</th>
                      <th className="px-4 py-3">Set</th>
                      <th className="px-4 py-3">Rarity</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {bulkSearchResults.map((card) => {
                      const edit = getBulkSearchEdit(card);
                      const dirty = edit.price !== String(card.price) || edit.stock !== String(card.stock);
                      return (
                        <tr key={card.id} className="bg-zinc-950">
                          <td className="px-4 py-2 font-medium text-zinc-200">{card.name}</td>
                          <td className="px-4 py-2 text-zinc-500">{card.set}</td>
                          <td className="px-4 py-2 text-zinc-400">{card.rarity}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={edit.price}
                              onChange={(e) => setBulkSearchEdit(card.id, "price", e.target.value)}
                              className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min={0}
                              value={edit.stock}
                              onChange={(e) => setBulkSearchEdit(card.id, "stock", e.target.value)}
                              className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <OwnerCell
                              cardId={card.id}
                              stock={Number(edit.stock) || card.stock}
                              owner={ownerMap.get(card.id) ?? "badgy"}
                              split={splitMap.get(card.id) ?? null}
                              consigners={consigners}
                              onSave={saveOwner}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => saveBulkSearchCard(card)}
                              disabled={!dirty || bulkSearchSaving === card.id}
                              className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
                            >
                              {bulkSearchSaving === card.id ? "Saving..." : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {bulkSearchUnmatched.length > 0 && (
              <div className="mt-3 rounded-lg border border-yellow-800 bg-yellow-950/30 px-4 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-500">
                  Not found ({bulkSearchUnmatched.length})
                </p>
                <ul className="space-y-0.5 text-sm text-yellow-300">
                  {bulkSearchUnmatched.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            )}
            {bulkSearchResults.length === 0 && bulkSearchUnmatched.length === 0 && (
              <p className="text-sm text-zinc-500">No cards matched.</p>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search card name..."
          className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <select
          value={set}
          onChange={(e) => setSet(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="All">All sets</option>
          {sets.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="All">All rarities</option>
          {rarities.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="All">All colors</option>
          {colors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="All">All owners</option>
          {consigners.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="stock-asc">Stock: Low to High</option>
          <option value="stock-desc">Stock: High to Low</option>
        </select>
      </div>

      <p className="mb-4 text-sm text-zinc-500">{filtered.length} card(s)</p>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Set</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.slice(0, 200).map((card) => {
              const edit = getEdit(card);
              const dirty = edit.price !== String(card.price) || edit.stock !== String(card.stock);
              return (
                <tr key={card.id} className="bg-zinc-950">
                  <td className="px-4 py-2 text-zinc-200">{card.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{card.set}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={edit.price}
                      onChange={(e) => setEdit(card.id, "price", e.target.value)}
                      className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={edit.stock}
                      onChange={(e) => setEdit(card.id, "stock", e.target.value)}
                      className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <OwnerCell
                      cardId={card.id}
                      stock={Number(edit.stock) || card.stock}
                      owner={ownerMap.get(card.id) ?? "badgy"}
                      split={splitMap.get(card.id) ?? null}
                      consigners={consigners}
                      onSave={saveOwner}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => save(card)}
                      disabled={!dirty || savingId === card.id}
                      className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {savingId === card.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > 200 && (
        <p className="mt-3 text-xs text-zinc-500">Showing first 200 results — narrow your search to see more.</p>
      )}
    </div>
  );
}
