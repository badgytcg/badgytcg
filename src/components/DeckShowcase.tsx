"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/context/StoreContext";
import { matchDeckToInventory } from "@/lib/inventory";
import { parseDeckCode } from "@/lib/deckParser";
import { Card } from "@/lib/types";

type FeaturedDeck = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number;
  cardList: string;
};

export default function DeckShowcase({ catalog }: { catalog: Card[] }) {
  const { addManyToCart, addToWishlist } = useStore();
  const [decks, setDecks] = useState<FeaturedDeck[]>([]);
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((d) => setDecks(d.decks ?? []));
  }, []);

  const prev = useCallback(() => setIndex((i) => (i - 1 + decks.length) % decks.length), [decks.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % decks.length), [decks.length]);

  // Auto-cycle every 6 seconds
  useEffect(() => {
    if (decks.length <= 1) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [decks.length, next]);

  // Reset index if decks change
  useEffect(() => { setIndex(0); }, [decks]);

  if (decks.length === 0) return null;

  const deck = decks[index];

  function handleBuy() {
    try {
      const parsed = parseDeckCode(deck.cardList);
      const result = matchDeckToInventory(parsed, deck.price, catalog);
      addManyToCart(result.available.map((a) => ({ cardId: a.card.id, qty: a.qty })));
      if (result.missing.length > 0) {
        addToWishlist(result.missing);
      }
      setAdded((prev) => ({ ...prev, [deck.id]: true }));
      setTimeout(() => setAdded((prev) => ({ ...prev, [deck.id]: false })), 2500);
    } catch {
      // If parse fails, nothing to add
    }
  }

  return (
    <section className="bg-gradient-to-b from-zinc-950 to-purple-950/30 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Ready to Play</p>
            <h2 className="mt-1 font-[var(--font-baloo)] text-2xl font-extrabold uppercase text-white sm:text-3xl">
              Pre-Built Decks
            </h2>
          </div>
          {decks.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:border-purple-500 hover:text-purple-300"
                aria-label="Previous deck"
              >
                ‹
              </button>
              <span className="text-xs text-zinc-600">
                {index + 1} / {decks.length}
              </span>
              <button
                onClick={next}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:border-purple-500 hover:text-purple-300"
                aria-label="Next deck"
              >
                ›
              </button>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-purple-950/30">
          <div className="grid gap-0 lg:grid-cols-2">
            {/* Left: deck info */}
            <div className="flex flex-col justify-between p-8">
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                      deck.type === "meta"
                        ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30"
                        : "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                    }`}
                  >
                    {deck.type === "meta" ? "Meta Deck" : "Starter Deck"}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">{deck.name}</h3>
                {deck.description && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{deck.description}</p>
                )}
              </div>

              <div className="mt-8">
                <p className="text-3xl font-extrabold text-green-400">${deck.price.toFixed(2)}</p>
                <p className="mt-1 text-xs text-zinc-500">Bundle price · in-stock cards added to cart, rest to wishlist</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleBuy}
                    disabled={!!added[deck.id]}
                    className="rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 disabled:bg-green-700 disabled:shadow-none"
                  >
                    {added[deck.id] ? "Added to Cart!" : "Buy This Deck"}
                  </button>
                  <a
                    href="/vibes/deck-import"
                    className="rounded-full border-2 border-zinc-700 px-6 py-3 font-bold text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                  >
                    Import Custom Deck
                  </a>
                </div>
              </div>
            </div>

            {/* Right: card list preview */}
            <div className="border-t border-zinc-800 bg-zinc-950/60 p-8 lg:border-l lg:border-t-0">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Deck Contents</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                {deck.cardList
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => {
                    const m = /^(\d+)\s+(.+)$/.exec(line.trim());
                    if (!m) return null;
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-right font-bold text-purple-400">{m[1]}x</span>
                        <span className="truncate text-zinc-300">{m[2]}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        </div>

        {/* Dot indicators */}
        {decks.length > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {decks.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-purple-500" : "w-2 bg-zinc-700 hover:bg-zinc-500"}`}
                aria-label={`Go to deck ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
