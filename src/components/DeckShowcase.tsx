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
  discount: number;
  cardList: string;
};

type ResolvedCard = { qty: number; name: string; image: string | null };

type ResolvedDeck = FeaturedDeck & {
  basePrice: number;
  resolvedPrice: number;
  previewImage: string | null;
  resolvedCards: ResolvedCard[];
};

function resolveDeck(deck: FeaturedDeck, catalog: Card[]): ResolvedDeck {
  const lines = deck.cardList
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
  const resolvedCards: ResolvedCard[] = [];

  for (const line of lines) {
    const lower = line.name.toLowerCase();
    const match =
      lowerCatalog.find((c) => c._lower === lower) ??
      lowerCatalog.find((c) => c._lower.includes(lower)) ??
      lowerCatalog.find((c) => lower.includes(c._lower));
    const image = match?.image ?? null;
    resolvedPrice += (match?.price ?? 0) * line.qty;
    if (!previewImage && image) previewImage = image;
    resolvedCards.push({ qty: line.qty, name: line.name, image });
  }

  const basePrice = (deck.price && deck.price > 0) ? deck.price : resolvedPrice;
  const finalPrice = Math.max(0, basePrice - (deck.discount ?? 0));

  return {
    ...deck,
    basePrice,
    resolvedPrice: finalPrice,
    previewImage,
    resolvedCards,
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

            {/* Left: hero card + deck info */}
            <div className="relative flex flex-col justify-between p-8">
              {deck.previewImage && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-l-2xl opacity-20">
                  <Image src={deck.previewImage} alt="" fill sizes="600px" className="scale-110 object-cover object-center blur-sm" unoptimized />
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
              </div>

              <div className="relative mt-8">
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-extrabold text-green-400">${deck.resolvedPrice.toFixed(2)}</p>
                  {deck.discount > 0 && (
                    <p className="text-lg text-zinc-500 line-through">${deck.basePrice.toFixed(2)}</p>
                  )}
                </div>
                {deck.discount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-green-500">You save ${deck.discount.toFixed(2)}</p>
                )}
                <p className="mt-1 text-xs text-zinc-500">Based on current card prices</p>
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

            {/* Right: description + card image grid */}
            <div className="flex flex-col border-t border-zinc-800 bg-zinc-950/60 lg:border-l lg:border-t-0">
              {/* Description banner */}
              {deck.description && (
                <div className="border-b border-zinc-800 px-6 py-5">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">About This Deck</p>
                  <p className="text-sm leading-relaxed text-zinc-300">{deck.description}</p>
                </div>
              )}

              {/* Card image grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Deck Contents</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {deck.resolvedCards.map((card, i) => (
                    <div key={i} className="group relative flex flex-col items-center gap-1">
                      <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "3/4" }}>
                        {card.image ? (
                          <Image
                            src={card.image}
                            alt={card.name}
                            fill
                            sizes="100px"
                            className="object-cover transition-transform group-hover:scale-105"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[9px] text-zinc-600">
                            ?
                          </div>
                        )}
                        {/* Qty badge */}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-purple-300">
                          ×{card.qty}
                        </span>
                      </div>
                      <p className="line-clamp-1 w-full text-center text-[9px] text-zinc-500" title={card.name}>
                        {card.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
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
