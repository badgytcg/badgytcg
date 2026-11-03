"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { matchDeckToInventory } from "@/lib/inventory";
import { Card } from "@/lib/types";
import type { MetaDeckView } from "@/lib/metaDecks";

// Color-category -> pip color. Mirrors the browse filter colors.
const COLOR_PIP: Record<string, string> = {
  Yellow: "bg-yellow-400",
  Red: "bg-red-500",
  Blue: "bg-blue-500",
  Green: "bg-green-500",
  Purple: "bg-purple-500",
  "Multi-color": "bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500",
  Colorless: "bg-zinc-500",
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function DeckRow({ deck }: { deck: MetaDeckView }) {
  const { addManyToCart, addToWishlist } = useStore();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function buyFullDeck() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const catalog: Card[] = await fetch("/api/cards").then((r) => r.json()).then((d) => d.cards ?? []);
      const parsed = { deckName: deck.name, entries: deck.cards.map((c) => ({ name: c.name, qty: c.count })) };
      const result = matchDeckToInventory(parsed, 0, catalog);
      if (result.available.length > 0) addManyToCart(result.available.map((a) => ({ cardId: a.card.id, qty: a.qty })));
      if (result.missing.length > 0) addToWishlist(result.missing);
      setState("done");
    } catch {
      setState("idle");
    }
  }

  const distinctInStock = deck.cards.filter((c) => c.cardId && c.inStock > 0).length;
  const distinctTotal = deck.cards.length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-zinc-100" title={deck.name}>{deck.name}</span>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              deck.source === "badgytcg"
                ? "border-purple-500/50 bg-purple-900/40 text-purple-300"
                : "border-sky-600/50 bg-sky-900/30 text-sky-300"
            }`}
          >
            {deck.source === "badgytcg" ? "BadgyTCG" : "via Vibes Decks"}
          </span>
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-purple-300">
            ×{deck.copiesOfCard}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
          {deck.colors.length > 0 && (
            <span className="flex items-center gap-1">
              {deck.colors.map((c) => (
                <span key={c} className={`h-2.5 w-2.5 rounded-full ${COLOR_PIP[c] ?? "bg-zinc-500"}`} title={c} />
              ))}
            </span>
          )}
          {deck.archetype && <span className="text-zinc-300">{deck.archetype}</span>}
          <span className="tabular-nums font-medium text-purple-300">{money(deck.totalCents)}</span>
          <span className={distinctInStock === distinctTotal ? "text-green-400" : "text-amber-400"}>
            {distinctInStock} of {distinctTotal} in stock
          </span>
          {deck.author && (
            <span className="text-zinc-500">
              by {deck.author}{deck.source === "vibesdecks" ? " · Vibes Decks" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={deck.viewHref}
          target={deck.external ? "_blank" : undefined}
          rel={deck.external ? "noopener noreferrer" : undefined}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300"
        >
          View deck{deck.external ? " ↗" : ""}
        </a>
        <button
          onClick={buyFullDeck}
          disabled={state !== "idle" || distinctInStock === 0}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:cursor-default disabled:bg-zinc-700 disabled:text-zinc-400"
          title={distinctInStock === 0 ? "No cards from this deck are in stock yet" : undefined}
        >
          {state === "done" ? "Added ✓" : state === "loading" ? "Adding…" : "Buy full deck"}
        </button>
      </div>
    </div>
  );
}

export default function PlayedInDecks({ decks }: { decks: MetaDeckView[] }) {
  const [showAll, setShowAll] = useState(false);
  if (decks.length === 0) return null;

  const visible = showAll ? decks : decks.slice(0, 6);

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Played in these meta decks</h2>
        <span className="text-xs text-zinc-600">{decks.length} deck{decks.length === 1 ? "" : "s"}</span>
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((d) => <DeckRow key={d.key} deck={d} />)}
      </div>
      {decks.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full rounded-lg border border-zinc-800 py-2 text-xs font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          {showAll ? "Show fewer" : `Show ${decks.length - 6} more`}
        </button>
      )}
      <p className="mt-3 text-[11px] text-zinc-600">
        Deck prices and stock are BadgyTCG&apos;s. &quot;via Vibes Decks&quot; decks link back to their page on vibesdecks.com.
      </p>
    </section>
  );
}
