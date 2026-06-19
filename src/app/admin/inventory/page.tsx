"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

export default function AdminInventoryPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () => cards.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [cards, query]
  );

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
      <h1 className="mb-4 text-2xl font-bold text-zinc-100">Inventory</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search card name..."
        className="mb-4 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
      />
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
