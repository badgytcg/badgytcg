"use client";

import { useEffect, useState } from "react";

interface SpecialCard {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  price: number;
  grade: string | null;
  set: string | null;
}

const BLANK = { name: "", description: "", imageUrl: "", price: "", grade: "", set: "" };

export default function AdminSpecialPage() {
  const [cards, setCards] = useState<SpecialCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [creating, setCreating] = useState(false);

  function load() {
    fetch("/api/admin/special-cards")
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setLoading(false);
      });
  }
  useEffect(load, []);

  async function createCard() {
    const price = Number(form.price);
    if (!form.name || !form.imageUrl || !Number.isFinite(price)) return;

    setCreating(true);
    await fetch("/api/admin/special-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        imageUrl: form.imageUrl,
        price,
        grade: form.grade || null,
        set: form.set || null,
      }),
    });
    setForm(BLANK);
    setCreating(false);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/special-cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Graded &amp; Special Foils</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Fully manual inventory — no stock field. Add one when you have it, remove it once it sells. These
        show up under the &quot;Graded &amp; Foils&quot; tab in Vibes.
      </p>

      <div className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add Item</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input type="number" step="0.01" min={0} placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Grade (e.g. PSA 9)" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Set (optional)" value={form.set} onChange={(e) => setForm({ ...form, set: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </div>
        <button
          onClick={createCard}
          disabled={creating || !form.name || !form.imageUrl || !form.price}
          className="mt-3 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
        >
          {creating ? "Adding..." : "Add Item"}
        </button>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Current Listings ({cards.length})
      </h2>
      {cards.length === 0 ? (
        <p className="text-sm text-zinc-500">None yet.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.imageUrl} alt={card.name} className="h-16 w-12 rounded object-cover" />
              <div className="flex-1">
                <p className="font-medium text-zinc-100">{card.name}</p>
                <p className="text-xs text-zinc-500">
                  {card.grade && `${card.grade} · `}{card.set ?? "Special"} · ${card.price.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => remove(card.id)}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
              >
                Remove (Sold)
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
