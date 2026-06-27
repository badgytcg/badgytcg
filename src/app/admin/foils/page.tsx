"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

interface FoilRow {
  cardId: string;
  name: string;
  set: string;
  image: string;
  price: number;
  stock: number;
}

export default function AdminFoilsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [foilRows, setFoilRows] = useState<FoilRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});

  function load() {
    Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/admin/foil-inventory").then((r) => r.json()),
    ]).then(([cardsData, foilData]) => {
      setCards(cardsData.cards ?? []);
      setFoilRows(foilData.rows ?? []);
      setLoading(false);
    });
  }
  useEffect(load, []);

  const foilByCardId = useMemo(() => new Map(foilRows.map((r) => [r.cardId, r])), [foilRows]);

  const filtered = useMemo(
    () => (query ? cards.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 50) : []),
    [cards, query]
  );

  function getEdit(card: Card) {
    const existing = foilByCardId.get(card.id);
    return edits[card.id] ?? { price: existing ? String(existing.price) : card.price.toFixed(2), stock: existing ? String(existing.stock) : "0" };
  }

  function setEdit(cardId: string, field: "price" | "stock", value: string) {
    setEdits((prev) => ({ ...prev, [cardId]: { ...getEdit(cards.find((c) => c.id === cardId)!), [field]: value } }));
  }

  async function save(card: Card) {
    const edit = getEdit(card);
    const price = Number(edit.price);
    const stock = Number(edit.stock);
    if (!Number.isFinite(price) || !Number.isFinite(stock) || price < 0 || stock < 0) return;

    setSavingId(card.id);
    await fetch("/api/admin/foil-inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, price, stock }),
    });
    load();
    setSavingId(null);
  }

  async function removeFoil(cardId: string) {
    await fetch(`/api/admin/foil-inventory/${cardId}`, { method: "DELETE" });
    setFoilRows((prev) => prev.filter((r) => r.cardId !== cardId));
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Foil Inventory</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Foils are a separate stock/price from the regular card. Search a card below to add or edit its foil —
        the foil toggle only shows up on that card&apos;s page once it has a row here.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Stocked Foils ({foilRows.length})
        </h2>
        {foilRows.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet — search for a card below to add one.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Foil Price</th>
                  <th className="px-4 py-3">Foil Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {foilRows.map((row) => (
                  <tr key={row.cardId} className="bg-zinc-950">
                    <td className="px-4 py-2 text-zinc-200">{row.name}</td>
                    <td className="px-4 py-2 text-zinc-500">{row.set}</td>
                    <td className="px-4 py-2 text-zinc-300">${row.price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-zinc-300">{row.stock}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => removeFoil(row.cardId)}
                        className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add or Edit a Foil</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search card name..."
          className="mb-4 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Foil Price</th>
                  <th className="px-4 py-3">Foil Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((card) => {
                  const edit = getEdit(card);
                  return (
                    <tr key={card.id} className="bg-zinc-950">
                      <td className="px-4 py-2 text-zinc-200">{card.name}</td>
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
                          disabled={savingId === card.id}
                          className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
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
        )}
      </section>
    </div>
  );
}
