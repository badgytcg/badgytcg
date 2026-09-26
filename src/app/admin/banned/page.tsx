"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

interface BannedRow {
  cardId: string;
  cardName: string;
  createdAt: string;
}

export default function AdminBannedPage() {
  const [banned, setBanned] = useState<BannedRow[]>([]);
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/banned")
      .then((r) => r.json())
      .then((d) => { setBanned(d.banned ?? []); setLoading(false); });
  }
  useEffect(() => {
    load();
    fetch("/api/cards").then((r) => r.json()).then((d) => setCatalog(d.cards ?? []));
  }, []);

  const bannedIds = useMemo(() => new Set(banned.map((b) => b.cardId)), [banned]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q) && !bannedIds.has(c.id))
      .slice(0, 8);
  }, [catalog, query, bannedIds]);

  async function addBan(card: Card) {
    setBusy(card.id);
    const res = await fetch("/api/admin/banned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id }),
    });
    if (res.ok) { setQuery(""); load(); }
    else alert("Couldn't ban that card.");
    setBusy(null);
  }

  async function removeBan(cardId: string) {
    setBusy(cardId);
    await fetch(`/api/admin/banned/${cardId}`, { method: "DELETE" });
    setBanned((prev) => prev.filter((b) => b.cardId !== cardId));
    setBusy(null);
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-100">Banned Cards</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Cards banned from competitive play. Banned cards show a red &quot;⛔ Banned&quot; badge on the
        store and a warning on the card page. (Starter decks stay legal out of the box.)
      </p>

      {/* Add */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add a Banned Card</h2>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search card name…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => addBan(c)}
                    disabled={busy === c.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  >
                    <span>{c.name} <span className="text-xs text-zinc-500">· {c.set}</span></span>
                    <span className="text-xs text-red-400">Ban →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Current list */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Currently Banned ({banned.length})
      </h2>
      {banned.length === 0 ? (
        <p className="text-sm text-zinc-500">No cards are banned right now.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {banned.map((b) => (
            <li key={b.cardId} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-zinc-100">⛔ {b.cardName}</span>
              <button
                onClick={() => removeBan(b.cardId)}
                disabled={busy === b.cardId}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-green-500 hover:text-green-400 disabled:opacity-40"
              >
                {busy === b.cardId ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
