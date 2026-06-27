"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

type VariantKind = "foil" | "altfoil";
const VARIANT_LABEL: Record<VariantKind, string> = { foil: "Foil", altfoil: "Alt Foil" };

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

export default function AdminFoilsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [query, setQuery] = useState("");
  const [addKind, setAddKind] = useState<VariantKind>("foil");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string }>>({});

  function load() {
    Promise.all([
      fetch("/api/cards").then((r) => r.json()),
      fetch("/api/admin/foil-inventory").then((r) => r.json()),
    ]).then(([cardsData, rowsData]) => {
      setCards(cardsData.cards ?? []);
      setRows(rowsData.rows ?? []);
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

  async function removeVariant(cardId: string, kind: VariantKind) {
    await fetch(`/api/admin/foil-inventory/${cardId}?kind=${kind}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => !(r.cardId === cardId && r.kind === kind)));
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Foil &amp; Alt Foil Inventory</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Each variant has its own separate stock/price from the regular card. The toggle on a card&apos;s
        tile/page only shows the tiers that have a row here.
      </p>

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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((row) => (
                  <tr key={`${row.cardId}::${row.kind}`} className="bg-zinc-950">
                    <td className="px-4 py-2 text-zinc-200">{row.name}</td>
                    <td className="px-4 py-2 text-zinc-500">{row.set}</td>
                    <td className="px-4 py-2 text-purple-300">{row.kindLabel}</td>
                    <td className="px-4 py-2 text-zinc-300">${row.price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-zinc-300">{row.stock}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => removeVariant(row.cardId, row.kind)}
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add or Edit a Variant</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-zinc-700 p-0.5 text-sm">
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((card) => {
                  const edit = getEdit(card, addKind);
                  return (
                    <tr key={card.id} className="bg-zinc-950">
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
