"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";
import { variantCardId } from "@/lib/catalog";

type VariantKind = "foil" | "altfoil";
const VARIANT_LABEL: Record<VariantKind, string> = { foil: "Foil", altfoil: "Alt Foil" };
const BULK_ADD_PLACEHOLDER = `4 Get Rekt
1 Lil Waker
2 Mount Fuji
...`;

interface VariantRow {
  cardId: string;
  kind: VariantKind;
  kindLabel: string;
  name: string;
  set: string;
  image: string;
  price: number;
  stock: number;
}

interface MarketPriceEntry {
  cardId: string;
  source: string;
  price: number;
}

// Market prices keyed by variantCardId → source → price
type MarketMap = Map<string, Map<string, number>>;

const SOURCES = ["dyli", "minmax", "scg"] as const;
const SOURCE_LABEL: Record<string, string> = { dyli: "Dyli", minmax: "MinMax", scg: "SCG" };

export default function AdminFoilsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [marketMap, setMarketMap] = useState<MarketMap>(new Map());
  const [query, setQuery] = useState("");
  const [addKind, setAddKind] = useState<VariantKind>("foil");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});

  // SCG manual entry per row: key → price string being edited
  const [scgEdits, setScgEdits] = useState<Record<string, string>>({});
  const [scgSaving, setScgSaving] = useState<string | null>(null);

  // Bulk price update
  const [bulkSet, setBulkSet] = useState("All");
  const [bulkRarity, setBulkRarity] = useState("All");
  const [bulkKind, setBulkKind] = useState<"All" | VariantKind>("All");
  const [bulkMode, setBulkMode] = useState<"fixed" | "dyli" | "minmax" | "scg">("fixed");
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

  function load() {
    Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/admin/foil-inventory").then((r) => r.json()),
      fetch("/api/market-prices").then((r) => r.json()),
    ]).then(([cardsData, rowsData, mktData]) => {
      setCards(cardsData.cards ?? []);
      setRows(rowsData.rows ?? []);

      const map: MarketMap = new Map();
      for (const mp of (mktData.prices ?? []) as MarketPriceEntry[]) {
        if (!map.has(mp.cardId)) map.set(mp.cardId, new Map());
        map.get(mp.cardId)!.set(mp.source, mp.price);
      }
      setMarketMap(map);
      setLoading(false);
    });
  }
  useEffect(load, []);

  const rowByKey = useMemo(() => new Map(rows.map((r) => [`${r.cardId}::${r.kind}`, r])), [rows]);

  const filtered = useMemo(
    () => (query ? cards.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 50) : []),
    [cards, query]
  );

  function editKey(cardId: string, kind: VariantKind) {
    return `${cardId}::${kind}`;
  }

  function getEdit(card: Card, kind: VariantKind) {
    const existing = rowByKey.get(editKey(card.id, kind));
    return (
      edits[editKey(card.id, kind)] ?? {
        price: existing ? String(existing.price) : card.price.toFixed(2),
        stock: existing ? String(existing.stock) : "0",
      }
    );
  }

  function setEdit(cardId: string, kind: VariantKind, field: "price" | "stock", value: string) {
    const card = cards.find((c) => c.id === cardId)!;
    setEdits((prev) => ({ ...prev, [editKey(cardId, kind)]: { ...getEdit(card, kind), [field]: value } }));
  }

  function getMarketPrice(cardId: string, kind: VariantKind, source: string): number | null {
    const vid = variantCardId(cardId, kind);
    return marketMap.get(vid)?.get(source) ?? null;
  }

  function applyMarketPrice(card: Card, kind: VariantKind, source: string) {
    const p = getMarketPrice(card.id, kind, source);
    if (p == null) return;
    setEdits((prev) => ({ ...prev, [editKey(card.id, kind)]: { ...getEdit(card, kind), price: p.toFixed(2) } }));
  }

  // Apply market price from a VariantRow (used in the stocked-variants table where card may or may not be loaded)
  function applyMarketPriceFromRow(row: VariantRow, source: string) {
    const card = cards.find((c) => c.id === row.cardId);
    if (!card) return;
    applyMarketPrice(card, row.kind, source);
  }

  async function save(card: Card, kind: VariantKind) {
    const edit = getEdit(card, kind);
    const price = Number(edit.price);
    const stock = Number(edit.stock);
    if (!Number.isFinite(price) || !Number.isFinite(stock) || price < 0 || stock < 0) return;

    setSavingId(editKey(card.id, kind));
    await fetch("/api/admin/foil-inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, kind, price, stock }),
    });
    load();
    setSavingId(null);
  }

  async function saveScg(cardId: string, kind: VariantKind) {
    const key = editKey(cardId, kind);
    const raw = scgEdits[key];
    const price = Number(raw);
    if (!raw || !Number.isFinite(price) || price < 0) return;
    setScgSaving(key);
    const vid = variantCardId(cardId, kind);
    await fetch("/api/admin/market-prices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: vid, source: "scg", price }),
    });
    // Update local marketMap optimistically
    setMarketMap((prev) => {
      const next = new Map(prev);
      if (!next.has(vid)) next.set(vid, new Map());
      next.get(vid)!.set("scg", price);
      return next;
    });
    setScgEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setScgSaving(null);
  }

  async function removeVariant(cardId: string, kind: VariantKind) {
    await fetch(`/api/admin/foil-inventory/${cardId}?kind=${kind}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => !(r.cardId === cardId && r.kind === kind)));
  }

  const sets = useMemo(() => Array.from(new Set(rows.map((r) => r.set))).sort(), [rows]);
  const rarities = useMemo(() => Array.from(new Set(rows.map((r) => cards.find((c) => c.id === r.cardId)?.rarity).filter(Boolean) as string[])).sort(), [rows, cards]);

  const bulkMatches = useMemo(() =>
    rows.filter((r) => {
      const card = cards.find((c) => c.id === r.cardId);
      return (
        (bulkSet === "All" || r.set === bulkSet) &&
        (bulkRarity === "All" || card?.rarity === bulkRarity) &&
        (bulkKind === "All" || r.kind === bulkKind)
      );
    }),
    [rows, cards, bulkSet, bulkRarity, bulkKind]
  );

  async function applyBulkUpdate() {
    if (bulkMatches.length === 0) return;
    const fixedPrice = bulkMode === "fixed" ? Number(bulkPrice) : undefined;
    if (bulkMode === "fixed" && (!Number.isFinite(fixedPrice) || fixedPrice! < 0)) return;

    const modeLabel = bulkMode === "fixed" ? `$${fixedPrice!.toFixed(2)}` : `${SOURCE_LABEL[bulkMode]} floor`;
    if (!window.confirm(`Set price to ${modeLabel} for ${bulkMatches.length} foil variant(s)?`)) return;

    setBulkApplying(true);
    setBulkResult(null);
    let updated = 0;
    let skipped = 0;

    for (const row of bulkMatches) {
      let price: number;
      if (bulkMode === "fixed") {
        price = fixedPrice!;
      } else {
        const p = getMarketPrice(row.cardId, row.kind, bulkMode);
        if (p == null) { skipped++; continue; }
        price = p;
      }
      await fetch("/api/admin/foil-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: row.cardId, kind: row.kind, price, stock: row.stock }),
      });
      updated++;
    }

    const skipMsg = skipped > 0 ? `, skipped ${skipped} (no ${SOURCE_LABEL[bulkMode]} price)` : "";
    setBulkResult(`Updated ${updated} variant(s)${skipMsg}.`);
    setBulkApplying(false);
    load();
  }

  async function applyBulkAdd() {
    if (!bulkAddText.trim()) return;
    setBulkAdding(true);
    setBulkAddError(null);
    setBulkAddResult(null);
    try {
      const res = await fetch("/api/admin/foil-inventory/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulkAddText, kind: addKind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkAddError(data.error ?? "Couldn't parse that list.");
        return;
      }
      setBulkAddResult(data);
      load();
      if (data.unmatched.length === 0) setBulkAddText("");
    } catch {
      setBulkAddError("Bulk add failed — try again in a moment.");
    }
    setBulkAdding(false);
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Foil &amp; Alt Foil Inventory</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Each variant has its own separate stock/price from the regular card. The toggle on a card&apos;s
        tile/page only shows the tiers that have a row here.
      </p>

      {/* Bulk price update */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">Bulk Price Update</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Pick a set/rarity/variant, then apply a price to just those foils — everything outside the filter is untouched.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Set</label>
            <select value={bulkSet} onChange={(e) => setBulkSet(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <option value="All">All sets</option>
              {sets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Rarity</label>
            <select value={bulkRarity} onChange={(e) => setBulkRarity(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <option value="All">All rarities</option>
              {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Variant</label>
            <select value={bulkKind} onChange={(e) => setBulkKind(e.target.value as "All" | VariantKind)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <option value="All">All variants</option>
              <option value="foil">Foil</option>
              <option value="altfoil">Alt Foil</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Set price to</label>
            <div className="flex rounded-full border border-zinc-700 p-0.5 text-sm">
              {(["fixed", "dyli", "minmax", "scg"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBulkMode(mode)}
                  className={`rounded-full px-3 py-1 ${bulkMode === mode ? "bg-purple-600 text-white" : "text-zinc-400"}`}
                >
                  {mode === "fixed" ? "Fixed amount" : `${SOURCE_LABEL[mode]} floor price`}
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
            {bulkApplying ? "Applying…" : `Apply to ${bulkMatches.length} variant(s)`}
          </button>
        </div>
        {bulkResult && <p className="mt-3 text-sm text-zinc-400">{bulkResult}</p>}
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Stocked Variants ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet — search for a card below to add one.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Dyli</th>
                  <th className="px-4 py-3">MinMax</th>
                  <th className="px-4 py-3">SCG</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((row) => {
                  const key = `${row.cardId}::${row.kind}`;
                  const card = cards.find((c) => c.id === row.cardId);
                  const edit = card
                    ? getEdit(card, row.kind)
                    : edits[key] ?? { price: String(row.price), stock: String(row.stock) };
                  const dyliP = getMarketPrice(row.cardId, row.kind, "dyli");
                  const mmP = getMarketPrice(row.cardId, row.kind, "minmax");
                  const scgP = getMarketPrice(row.cardId, row.kind, "scg");
                  const scgEditVal = scgEdits[key];

                  return (
                    <tr key={key} className="bg-zinc-950 align-top">
                      <td className="px-4 py-2 text-zinc-200">{row.name}</td>
                      <td className="px-4 py-2 text-zinc-500">{row.set}</td>
                      <td className="px-4 py-2 text-purple-300">{row.kindLabel}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={edit.price}
                          onChange={(e) =>
                            card
                              ? setEdit(card.id, row.kind, "price", e.target.value)
                              : setEdits((prev) => ({ ...prev, [key]: { ...edit, price: e.target.value } }))
                          }
                          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          value={edit.stock}
                          onChange={(e) =>
                            card
                              ? setEdit(card.id, row.kind, "stock", e.target.value)
                              : setEdits((prev) => ({ ...prev, [key]: { ...edit, stock: e.target.value } }))
                          }
                          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                        />
                      </td>

                      {/* Dyli */}
                      <td className="px-4 py-2">
                        {dyliP != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-300">${dyliP.toFixed(2)}</span>
                            {card && (
                              <button onClick={() => applyMarketPriceFromRow(row, "dyli")} className="text-[10px] text-purple-400 hover:text-purple-300">
                                use →
                              </button>
                            )}
                          </div>
                        ) : <span className="text-zinc-700">—</span>}
                      </td>

                      {/* MinMax */}
                      <td className="px-4 py-2">
                        {mmP != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-300">${mmP.toFixed(2)}</span>
                            {card && (
                              <button onClick={() => applyMarketPriceFromRow(row, "minmax")} className="text-[10px] text-purple-400 hover:text-purple-300">
                                use →
                              </button>
                            )}
                          </div>
                        ) : <span className="text-zinc-700">—</span>}
                      </td>

                      {/* SCG — shows price + use button if exists, else manual entry */}
                      <td className="px-4 py-2">
                        {scgP != null && scgEditVal === undefined ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-300">${scgP.toFixed(2)}</span>
                            <div className="flex gap-2">
                              {card && (
                                <button onClick={() => applyMarketPriceFromRow(row, "scg")} className="text-[10px] text-purple-400 hover:text-purple-300">
                                  use →
                                </button>
                              )}
                              <button
                                onClick={() => setScgEdits((prev) => ({ ...prev, [key]: scgP.toFixed(2) }))}
                                className="text-[10px] text-zinc-600 hover:text-zinc-400"
                              >
                                edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0.00"
                              value={scgEditVal ?? ""}
                              onChange={(e) => setScgEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-100"
                            />
                            <button
                              onClick={() => saveScg(row.cardId, row.kind)}
                              disabled={scgSaving === key || !scgEditVal}
                              className="rounded bg-purple-700 px-1.5 py-1 text-[10px] text-white hover:bg-purple-600 disabled:bg-zinc-700"
                            >
                              {scgSaving === key ? "…" : "Set"}
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => card && save(card, row.kind)}
                            disabled={savingId === key || !card}
                            className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
                          >
                            {savingId === key ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => removeVariant(row.cardId, row.kind)}
                            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-4 flex rounded-full border border-zinc-700 p-0.5 text-sm">
        {(["foil", "altfoil"] as VariantKind[]).map((kind) => (
          <button
            key={kind}
            onClick={() => setAddKind(kind)}
            className={`rounded-full px-4 py-1 ${addKind === kind ? "bg-purple-600 text-white" : "text-zinc-400"}`}
          >
            {VARIANT_LABEL[kind]}
          </button>
        ))}
      </div>

      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Bulk Add {VARIANT_LABEL[addKind]} by Text
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Paste a list like &quot;4 Get Rekt&quot; (one per line) — quantities get added to whatever&apos;s
          already in {VARIANT_LABEL[addKind].toLowerCase()} stock. Every line in this paste uses the{" "}
          {VARIANT_LABEL[addKind]} tier selected above.
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
          {bulkAdding ? "Adding..." : `Add to ${VARIANT_LABEL[addKind]} Inventory`}
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
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add or Edit a Variant</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search card name..."
            className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">{VARIANT_LABEL[addKind]} Price</th>
                  <th className="px-4 py-3">{VARIANT_LABEL[addKind]} Stock</th>
                  <th className="px-4 py-3">Dyli</th>
                  <th className="px-4 py-3">MinMax</th>
                  <th className="px-4 py-3">SCG</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((card) => {
                  const edit = getEdit(card, addKind);
                  const key = editKey(card.id, addKind);
                  const dyliP = getMarketPrice(card.id, addKind, "dyli");
                  const mmP = getMarketPrice(card.id, addKind, "minmax");
                  const scgP = getMarketPrice(card.id, addKind, "scg");
                  const scgEditVal = scgEdits[key];

                  return (
                    <tr key={card.id} className="bg-zinc-950 align-top">
                      <td className="px-4 py-2 text-zinc-200">{card.name}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={edit.price}
                          onChange={(e) => setEdit(card.id, addKind, "price", e.target.value)}
                          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          value={edit.stock}
                          onChange={(e) => setEdit(card.id, addKind, "stock", e.target.value)}
                          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                        />
                      </td>

                      {/* Dyli */}
                      <td className="px-4 py-2">
                        {dyliP != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-300">${dyliP.toFixed(2)}</span>
                            <button onClick={() => applyMarketPrice(card, addKind, "dyli")} className="text-left text-[10px] text-purple-400 hover:text-purple-300">
                              use →
                            </button>
                          </div>
                        ) : <span className="text-zinc-700">—</span>}
                      </td>

                      {/* MinMax */}
                      <td className="px-4 py-2">
                        {mmP != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-300">${mmP.toFixed(2)}</span>
                            <button onClick={() => applyMarketPrice(card, addKind, "minmax")} className="text-left text-[10px] text-purple-400 hover:text-purple-300">
                              use →
                            </button>
                          </div>
                        ) : <span className="text-zinc-700">—</span>}
                      </td>

                      {/* SCG */}
                      <td className="px-4 py-2">
                        {scgP != null && scgEditVal === undefined ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-300">${scgP.toFixed(2)}</span>
                            <div className="flex gap-2">
                              <button onClick={() => applyMarketPrice(card, addKind, "scg")} className="text-[10px] text-purple-400 hover:text-purple-300">
                                use →
                              </button>
                              <button
                                onClick={() => setScgEdits((prev) => ({ ...prev, [key]: scgP.toFixed(2) }))}
                                className="text-[10px] text-zinc-600 hover:text-zinc-400"
                              >
                                edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0.00"
                              value={scgEditVal ?? ""}
                              onChange={(e) => setScgEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-100"
                            />
                            <button
                              onClick={() => saveScg(card.id, addKind)}
                              disabled={scgSaving === key || !scgEditVal}
                              className="rounded bg-purple-700 px-1.5 py-1 text-[10px] text-white hover:bg-purple-600 disabled:bg-zinc-700"
                            >
                              {scgSaving === key ? "…" : "Set"}
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-2">
                        <button
                          onClick={() => save(card, addKind)}
                          disabled={savingId === editKey(card.id, addKind)}
                          className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
                        >
                          {savingId === editKey(card.id, addKind) ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
