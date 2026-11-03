"use client";

import { useEffect, useState } from "react";
import { parseDeckCode } from "@/lib/deckParser";

type FeaturedDeck = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  cardList: string;
  active: boolean;
};

function metaFrom(description: string | null): { author: string; url: string } {
  if (!description) return { author: "", url: "" };
  try {
    const o = JSON.parse(description);
    return { author: o.author ?? "", url: o.url ?? "" };
  } catch { return { author: "", url: "" }; }
}

export default function AdminMetaDecksPage() {
  const [decks, setDecks] = useState<FeaturedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [cardList, setCardList] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/decks");
    const data = await res.json();
    setDecks((data.decks ?? []).filter((d: FeaturedDeck) => d.type === "vibes"));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    setError(null);
    if (!name.trim() || !cardList.trim()) { setError("Deck name and card list are required."); return; }
    // Validate the decklist parses (same parser deck import uses).
    let count = 0;
    try { count = parseDeckCode(cardList).entries.length; } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that card list."); return;
    }
    if (count === 0) { setError("No cards found in that list."); return; }
    if (url.trim() && !/^https?:\/\/(www\.)?vibesdecks\.com\/d\//.test(url.trim())) {
      setError("Link should be a vibesdecks.com deck URL (…/d/…), or leave it blank.");
      return;
    }

    setSaving(true);
    const body = {
      name: name.trim(),
      type: "vibes",
      description: JSON.stringify({ author: author.trim() || null, url: url.trim() || null }),
      cardList,
      active: true,
      sortOrder: 0,
    };
    const res = await fetch("/api/admin/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Save failed");
    } else {
      setName(""); setAuthor(""); setUrl(""); setCardList("");
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this Vibes Decks deck?")) return;
    await fetch(`/api/admin/decks/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-100">Meta Decks — via Vibes Decks</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Add a community deck so it appears in the <span className="text-zinc-200">&quot;Played in these meta decks&quot;</span> section
        on each card&apos;s page, credited to its author with a link back to vibesdecks.com. Paste the deck&apos;s card list
        (one <code className="text-zinc-300">4 Card Name</code> per line, or the JSON deck code).
      </p>

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Deck Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              placeholder="Clam Control Green" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Author <span className="text-zinc-600">— vibesdecks username</span></label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              placeholder="PrisonSBF" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-400">Vibes Decks link <span className="text-zinc-600">— the …/d/… page (optional)</span></label>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              placeholder="https://www.vibesdecks.com/d/clam-control-green-…" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Card List * <span className="text-zinc-600">(one per line: &quot;4 Card Name&quot;)</span>
            </label>
            <textarea value={cardList} onChange={(e) => setCardList(e.target.value)} rows={8}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
              placeholder={"4 Popcorn Penguin\n4 Lil Frosty\n3 Patient Birb\n2 Colosseum"} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-4">
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50">
            {saving ? "Saving…" : "Add deck"}
          </button>
        </div>
      </div>

      <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-widest text-zinc-500">Imported decks</h2>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : decks.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-500">
          No manually-imported Vibes Decks yet. The 119 harvested decks still show automatically.
        </p>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => {
            const meta = metaFrom(deck.description);
            return (
              <div key={deck.id} className="flex items-start justify-between rounded-xl border border-zinc-700 bg-zinc-900 p-4">
                <div className="min-w-0">
                  <span className="font-semibold text-zinc-100">{deck.name}</span>
                  <p className="mt-1 text-xs text-zinc-500">
                    {deck.cardList.split("\n").filter(Boolean).length} card line(s)
                    {meta.author ? ` · by ${meta.author}` : ""}
                    {meta.url ? <> · <a href={meta.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">vibesdecks ↗</a></> : ""}
                  </p>
                </div>
                <button onClick={() => handleDelete(deck.id)}
                  className="shrink-0 rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-500 hover:border-red-800 hover:text-red-400">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
