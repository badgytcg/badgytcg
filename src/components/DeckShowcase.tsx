"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/lib/types";

type FeaturedDeck = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number | null;
  cardList: string;
};

type ResolvedDeck = FeaturedDeck & {
  resolvedPrice: number;
  previewImage: string | null;
  cardLines: { qty: number; name: string }[];
};

function resolveDeck(deck: FeaturedDeck, catalog: Card[]): ResolvedDeck {
  const cardLines = deck.cardList
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const m = /^(\d+)\s+(.+)$/.exec(line.trim());
      return m ? { qty: Number(m[1]), name: m[2].trim() } : null;
    })
    .filter((x): x is { qty: number; name: string } => x !== null);

  const lowerCatalog = catalog.map((c) => ({ ...c, _lower: c.name.toLowerCase() }));

  let resolvedPrice = 0;
  let previewImage: string | null = null;

  for (const line of cardLines) {
    const lower = line.name.toLowerCase();
    const match = lowerCatalog.find((c) => c._lower === lower)
      ?? lowerCatalog.find((c) => c._lower.includes(lower))
      ?? lowerCatalog.find((c) => lower.includes(c._lower));
    if (match) {
      resolvedPrice += match.price * line.qty;
      if (!previewImage && match.image) previewImage = match.image;
    }
  }

  return {
    ...deck,
    resolvedPrice: deck.price ?? resolvedPrice,
    previewImage,
    cardLines,
  };
}

export default function DeckShowcase({ catalog }: { catalog: Card[] }) {
  const [decks, setDecks] = useState<FeaturedDeck[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((d) => setDecks(d.decks ?? []));
  }, []);

  const resolved = useMemo(() => decks.map((d) => resolveDeck(d, catalog)), [decks, catalog]);

  const prev = useCallback(() => setIndex((i) => (i - 1 + decks.length) % decks.length), [decks.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % decks.length), [decks.length]);

  useEffect(() => {
    if (decks.length <= 1) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [decks.length, next]);

  useEffect(() => { setIndex(0); }, [decks]);

  if (resolved.length === 0) return null;

  const deck = resolved[index];

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
          {resolved.length > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:border-purple-500 hover:text-purple-300" aria-label="Previous deck">‹</button>
              <span className="text-xs text-zinc-600">{index + 1} / {resolved.length}</span>
              <button onClick={next} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:border-purple-500 hover:text-purple-300" aria-label="Next deck">›</button>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-purple-950/30">
          <div className="grid lg:grid-cols-2">

            {/* Left: hero image + deck info */}
            <div className="relative flex flex-col justify-between p-8">
              {deck.previewImage && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-l-2xl opacity-20">
                  <Image src={deck.previewImage} alt="" fill sizes="600px" className="object-cover object-center scale-110 blur-sm" unoptimized />
                </div>
              )}
              <div className="relative">
                {deck.previewImage && (
                  <div className="mb-6 flex justify-center">
                    <div className="relative h-52 w-36 overflow-hidden rounded-xl border-2 border-purple-500/40 shadow-2xl shadow-purple-950/60 sm:h-64 sm:w-44">
                      <Image src={deck.previewImage} alt={deck.name} fill sizes="180px" className="object-cover" unoptimized />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${deck.type === "meta" ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30" : "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"}`}>
                    {deck.type === "meta" ? "Meta Deck" : "Starter Deck"}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">{deck.name}</h3>
                {deck.description && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{deck.description}</p>
                )}
              </div>

              <div className="relative mt-8">
                <p className="text-3xl font-extrabold text-green-400">${deck.resolvedPrice.toFixed(2)}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {deck.price != null ? "Fixed bundle price" : "Based on current card prices"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/vibes/decks/${deck.id}`}
                    className="rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500"
                  >
                    View &amp; Buy This Deck
                  </Link>
                  <Link
                    href="/vibes/deck-import"
                    className="rounded-full border-2 border-zinc-700 px-6 py-3 font-bold text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                  >
                    Import Custom Deck
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: card list */}
            <div className="border-t border-zinc-800 bg-zinc-950/60 p-8 lg:border-l lg:border-t-0">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Deck Contents</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {deck.cardLines.map((line, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-right font-bold text-purple-400">{line.qty}x</span>
                    <span className="truncate text-zinc-300">{line.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {resolved.length > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {resolved.map((d, i) => (
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
