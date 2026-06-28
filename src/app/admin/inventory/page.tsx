"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

const SET_ORDER = ["Enter the Huddle", "Legend of the Lils", "Birb & Pengu"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic"];

type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
type BulkMode = "fixed" | "dyli";

export default function AdminInventoryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [set, setSet] = useState("All");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  const [bulkSet, setBulkSet] = useState("All");
  const [bulkRarity, setBulkRarity] = useState("All");
  const [bulkMode, setBulkMode] = useState<BulkMode>("fixed");
  const [bulkPrice, setBulkPrice] = useState("0.50");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  async function refreshMarketPrices() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/admin/market-prices/refresh", { method: "POST" });
      const data = await res.json();
      setRefreshResult(`Matched ${data.dyli} Dyli price(s) and ${data.minmax} MinMax price(s).`);
    } catch {
      setRefreshResult("Refresh failed — try again in a moment.");
    }
    setRefreshing(false);
  }

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setLoading(false);
      });
  }, []);

  const sets = useMemo(
    () => SET_ORDER.filter((s) => cards.some((c) => c.set === s)),
    [cards]
  );
  const rarities = useMemo(
    () => RARITY_ORDER.filter((r) => cards.some((c) => c.rarity === r)),
    [cards]
  );

  const bulkMatches = useMemo(
    () =>
      cards.filter(
        (c) => (bulkSet === "All" || c.set === bulkSet) && (bulkRarity === "All" || c.rarity === bulkRarity)
      ),
    [cards, bulkSet, bulkRarity]
  );

  async function applyBulkUpdate() {
    if (bulkMatches.length === 0) return;
    const price = bulkMode === "fixed" ? Number(bulkPrice) : undefined;
    if (bulkMode === "fixed" && (!Number.isFinite(price) || price! < 0)) return;

    const confirmMsg =
      bulkMode === "fixed"
        ? `Set price to $${price!.toFixed(2)} for ${bulkMatches.length} card(s) (${bulkSet === "All" ? "all sets" : bulkSet}, ${bulkRarity === "All" ? "all rarities" : bulkRarity})?`
        : `Set price to each card's current Dyli floor price for ${bulkMatches.length} card(s) (${bulkSet === "All" ? "all sets" : bulkSet}, ${bulkRarity === "All" ? "all rarities" : bulkRarity})? Cards with no Dyli price will be skipped.`;
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
          mode: bulkMode,
          price,
        }),
      });
      const data = await res.json();
      setBulkResult(
        bulkMode === "dyli"
          ? `Updated ${data.updated} card(s), skipped ${data.skipped} (no Dyli price yet).`
          : `Updated ${data.updated} card(s).`
      );
      const refreshed = await fetch("/api/cards").then((r) => r.json());
      setCards(refreshed.cards ?? []);
    } catch {
      setBulkResult("Bulk update failed — try again in a moment.");
    }
    setBulkApplying(false);
  }

  const filtered = useMemo(() => {
    const result = cards.filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) &&
        (set === "All" || c.set === set)
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
  }, [cards, query, set, sort]);

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
            <label className="mb-1 block text-xs text-zinc-500">Set price to</label>
            <div className="flex rounded-full border border-zinc-700 p-0.5 text-sm">
              <button
                onClick={() => setBulkMode("fixed")}
                className={`rounded-full px-3 py-1 ${bulkMode === "fixed" ? "bg-purple-600 text-white" : "text-zinc-400"}`}
              >
                Fixed amount
              </button>
              <button
                onClick={() => setBulkMode("dyli")}
                className={`rounded-full px-3 py-1 ${bulkMode === "dyli" ? "bg-purple-600 text-white" : "text-zinc-400"}`}
              >
                Dyli floor price
              </button>
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
