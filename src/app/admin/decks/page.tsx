"use client";

import { useEffect, useState } from "react";

type FeaturedDeck = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number | null;
  cardList: string;
  active: boolean;
  sortOrder: number;
};

const EMPTY: Omit<FeaturedDeck, "id"> = {
  name: "",
  type: "starter",
  description: "",
  price: null,
  cardList: "",
  active: true,
  sortOrder: 0,
};

type FormState = {
  name: string;
  type: string;
  description: string;
  priceOverride: string; // empty string = auto
  cardList: string;
  active: boolean;
  sortOrder: number;
};

const EMPTY_FORM: FormState = {
  name: "",
  type: "starter",
  description: "",
  priceOverride: "",
  cardList: "",
  active: true,
  sortOrder: 0,
};

function deckToForm(deck: FeaturedDeck): FormState {
  return {
    name: deck.name,
    type: deck.type,
    description: deck.description ?? "",
    priceOverride: deck.price != null ? String(deck.price) : "",
    cardList: deck.cardList,
    active: deck.active,
    sortOrder: deck.sortOrder,
  };
}

export default function AdminDecksPage() {
  const [decks, setDecks] = useState<FeaturedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/decks");
    const data = await res.json();
    setDecks(data.decks ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(deck: FeaturedDeck) {
    setForm(deckToForm(deck));
    setEditingId(deck.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.cardList.trim()) {
      setError("Name and card list are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const price = form.priceOverride.trim() !== "" ? Number(form.priceOverride) : null;
    const body = {
      name: form.name,
      type: form.type,
      description: form.description || null,
      price,
      cardList: form.cardList,
      active: form.active,
      sortOrder: Number(form.sortOrder),
    };
    const url = editingId ? `/api/admin/decks/${editingId}` : "/api/admin/decks";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    } else {
      setShowForm(false);
      setEditingId(null);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this deck?")) return;
    await fetch(`/api/admin/decks/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleActive(deck: FeaturedDeck) {
    await fetch(`/api/admin/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !deck.active }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Featured Decks</h1>
        <button
          onClick={startNew}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
        >
          + New Deck
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">
            {editingId ? "Edit Deck" : "New Deck"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Deck Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                placeholder="Purple at the Disco"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="starter">Starter</option>
                <option value="meta">Meta</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Bundle Price Override ($){" "}
                <span className="text-zinc-600">— leave blank to auto-sum card prices</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.priceOverride}
                onChange={(e) => setForm({ ...form, priceOverride: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                placeholder="Auto (sum of card prices)"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                placeholder="A balanced starter deck for new players..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Card List * <span className="text-zinc-600">(one per line: "4 Card Name")</span>
              </label>
              <textarea
                value={form.cardList}
                onChange={(e) => setForm({ ...form, cardList: e.target.value })}
                rows={8}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
                placeholder={"4 Get Rekt\n2 Nyan Cat\n3 Arches\n1 Baron Fishpockets"}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-purple-500"
              />
              <label htmlFor="active" className="text-sm text-zinc-300">Show on homepage</label>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Deck"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : decks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
          <p className="text-zinc-500">No featured decks yet.</p>
          <button onClick={startNew} className="mt-4 text-sm text-purple-400 hover:underline">
            Add your first deck
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className={`rounded-xl border p-4 ${deck.active ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 bg-zinc-900/40 opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                        deck.type === "meta"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {deck.type}
                    </span>
                    <span className="font-semibold text-zinc-100">{deck.name}</span>
                    {deck.price != null ? (
                      <span className="text-sm font-medium text-green-400">${deck.price.toFixed(2)} (fixed)</span>
                    ) : (
                      <span className="text-sm text-zinc-500">Price: auto</span>
                    )}
                  </div>
                  {deck.description && (
                    <p className="mt-1 text-sm text-zinc-400">{deck.description}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-600">
                    {deck.cardList.split("\n").filter(Boolean).length} card line(s) · order {deck.sortOrder}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(deck)}
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      deck.active
                        ? "border border-zinc-600 text-zinc-400 hover:border-zinc-400"
                        : "border border-green-800 text-green-400 hover:border-green-500"
                    }`}
                  >
                    {deck.active ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => startEdit(deck)}
                    className="rounded border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(deck.id)}
                    className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-500 hover:border-red-800 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
