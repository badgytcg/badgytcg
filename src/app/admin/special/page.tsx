"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

interface SpecialCard {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  price: number;
  grade: string | null;
  set: string | null;
  qty: number;
}

type EditFields = {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  grade: string;
  set: string;
  qty: string;
};

const BLANK: EditFields = { name: "", description: "", imageUrl: "", price: "", grade: "", set: "", qty: "1" };

function cardToEdit(card: SpecialCard): EditFields {
  return {
    name: card.name,
    description: card.description ?? "",
    imageUrl: card.imageUrl,
    price: String(card.price),
    grade: card.grade ?? "",
    set: card.set ?? "",
    qty: String(card.qty),
  };
}

export default function AdminSpecialPage() {
  const [cards, setCards] = useState<SpecialCard[]>([]);
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [form, setForm] = useState<EditFields>(BLANK);
  const [creating, setCreating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Inline edit state: cardId → EditFields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFields>(BLANK);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/special-cards")
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setLoading(false);
      });
  }
  useEffect(load, []);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => setCatalog(data.cards ?? []));
  }, []);

  const suggestions = useMemo(() => {
    const q = form.name.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, form.name]);

  function pickSuggestion(card: Card) {
    setForm((prev) => ({ ...prev, name: card.name, imageUrl: card.image, set: card.set }));
    setShowSuggestions(false);
  }

  async function createCard() {
    const price = Number(form.price);
    const qty = Number(form.qty) || 1;
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
        qty,
      }),
    });
    setForm(BLANK);
    setCreating(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this listing?")) return;
    await fetch(`/api/admin/special-cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function startEdit(card: SpecialCard) {
    setEditingId(card.id);
    setEditForm(cardToEdit(card));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    const price = Number(editForm.price);
    const qty = Number(editForm.qty) || 1;
    if (!editForm.name || !editForm.imageUrl || !Number.isFinite(price)) return;
    setSavingId(id);
    await fetch(`/api/admin/special-cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        imageUrl: editForm.imageUrl,
        price,
        grade: editForm.grade || null,
        set: editForm.set || null,
        qty,
      }),
    });
    setSavingId(null);
    setEditingId(null);
    load();
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Graded &amp; Special Foils</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Fully manual inventory. Set a quantity when you have multiples, adjust as they sell, and remove once
        you&apos;re out. These show up under the &quot;Graded &amp; Foils&quot; tab in Vibes.
      </p>

      {/* Add form */}
      <div className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add Item</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
                {suggestions.map((card) => (
                  <li key={card.id}>
                    <button type="button" onMouseDown={() => pickSuggestion(card)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={card.image} alt="" className="h-8 w-6 rounded object-cover" />
                      <span>{card.name}<span className="ml-1 text-xs text-zinc-500">· {card.set}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input type="number" step="0.01" min={0} placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Grade (e.g. PSA 9)" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Set (optional)" value={form.set} onChange={(e) => setForm({ ...form, set: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input type="number" min={1} placeholder="Quantity" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-2" />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Start typing a card name to pick it from the catalog — image and set fill in automatically.
        </p>
        <button
          onClick={createCard}
          disabled={creating || !form.name || !form.imageUrl || !form.price}
          className="mt-3 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
        >
          {creating ? "Adding..." : "Add Item"}
        </button>
      </div>

      {/* Listings */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Current Listings ({cards.length})
      </h2>
      {cards.length === 0 ? (
        <p className="text-sm text-zinc-500">None yet.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) =>
            editingId === card.id ? (
              /* ── Expanded inline edit form ── */
              <li key={card.id} className="rounded-xl border border-purple-700 bg-zinc-900 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input placeholder="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                  <input placeholder="Image URL" value={editForm.imageUrl} onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                  <input type="number" step="0.01" min={0} placeholder="Price" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                  <input placeholder="Grade (e.g. PSA 9)" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                  <input placeholder="Set (optional)" value={editForm.set} onChange={(e) => setEditForm({ ...editForm, set: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                  <input type="number" min={1} placeholder="Quantity" value={editForm.qty} onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
                  <input placeholder="Description (optional)" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-2" />
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => saveEdit(card.id)} disabled={savingId === card.id}
                    className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700">
                    {savingId === card.id ? "Saving..." : "Save"}
                  </button>
                  <button onClick={cancelEdit} className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              /* ── Collapsed listing row ── */
              <li key={card.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.imageUrl} alt={card.name} className="h-16 w-12 shrink-0 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-100">{card.name}</p>
                  <p className="text-xs text-zinc-500">
                    {card.grade && `${card.grade} · `}{card.set ?? "Special"} · ${card.price.toFixed(2)} · qty {card.qty}
                  </p>
                  {card.description && <p className="mt-0.5 truncate text-xs text-zinc-600">{card.description}</p>}
                </div>
                <button onClick={() => startEdit(card)}
                  className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-purple-500 hover:text-purple-300">
                  Edit
                </button>
                <button onClick={() => remove(card.id)}
                  className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400">
                  Remove
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
