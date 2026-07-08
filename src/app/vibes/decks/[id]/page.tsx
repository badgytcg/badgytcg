"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { matchDeckToInventory } from "@/lib/inventory";
import { parseDeckCode } from "@/lib/deckParser";
import { Card } from "@/lib/types";

type FeaturedDeck = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number | null;
  cardList: string;
};

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addManyToCart, addToWishlist } = useStore();

  const [deck, setDeck] = useState<FeaturedDeck | null>(null);
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [added, setAdded] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/decks/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/cards").then((r) => r.json()),
    ]).then(([deckData, cardData]) => {
      if (!deckData) { setNotFound(true); setLoading(false); return; }
      setDeck(deckData.deck);
      setCatalog(cardData.cards ?? []);
      setLoading(false);
    });
  }, [id]);

  const result = useMemo(() => {
    if (!deck || catalog.length === 0) return null;
    try {
      const parsed = parseDeckCode(deck.cardList);
      return matchDeckToInventory(parsed, deck.price ?? 0, catalog);
    } catch {
      return null;
    }
  }, [deck, catalog]);

  const resolvedPrice = useMemo(() => {
    if (!deck) return 0;
    if (deck.price != null) return deck.price;
    if (!result) return 0;
    return result.entries.reduce((sum, e) => sum + (e.card ? e.card.price * e.qty : 0), 0);
  }, [deck, result]);

  const inStockCount = result?.available.reduce((s, a) => s + a.qty, 0) ?? 0;
  const totalCount = result ? result.available.reduce((s, a) => s + a.qty, 0) + result.missing.reduce((s, m) => s + m.qty, 0) : 0;
  const isBundlePrice = deck?.price != null;

  function handleAddToCart() {
    if (!result) return;
    addManyToCart(result.available.map((a) => ({ cardId: a.card.id, qty: a.qty })));
    if (result.missing.length > 0) addToWishlist(result.missing);
    setAdded(true);
  }

  function handleRequestAll() {
    if (!result) return;
    addToWishlist(
      result.entries
        .filter((e): e is { card: Card; cardName: string; qty: number } => e.card !== null)
        .map((e) => ({ cardId: e.card.id, cardName: e.cardName, qty: e.qty, note: `Deck request: ${deck?.name}` }))
    );
    setRequested(true);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading deck…</div>
    );
  }

  if (notFound || !deck) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="text-zinc-400">Deck not found.</p>
        <Link href="/" className="mt-4 block text-sm text-purple-400 hover:underline">← Back to homepage</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Back */}
      <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-purple-400">
        ← Back to homepage
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
            deck.type === "meta"
              ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30"
              : "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
          }`}>
            {deck.type === "meta" ? "Meta Deck" : "Starter Deck"}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{deck.name}</h1>
          {deck.description && (
            <p className="mt-2 max-w-xl text-zinc-400">{deck.description}</p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {result && (
        <div className="mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Price</p>
            <p className="text-2xl font-extrabold text-green-400">${resolvedPrice.toFixed(2)}</p>
            {isBundlePrice && <p className="text-xs text-purple-400">Bundle deal</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">In Stock</p>
            <p className="text-2xl font-extrabold text-white">{inStockCount} <span className="text-lg text-zinc-500">/ {totalCount}</span></p>
          </div>
          {result.missing.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Need Sourcing</p>
              <p className="text-2xl font-extrabold text-yellow-400">{result.missing.length} types</p>
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-3">
            <button
              onClick={handleAddToCart}
              disabled={added || inStockCount === 0}
              className="rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 disabled:bg-zinc-700 disabled:shadow-none"
            >
              {added ? "Added to Cart!" : inStockCount === 0 ? "None in Stock" : "Add to Cart"}
            </button>
            <button
              onClick={handleRequestAll}
              disabled={requested}
              className="rounded-full border-2 border-zinc-700 px-6 py-3 font-bold text-zinc-300 hover:border-purple-500 hover:text-purple-300 disabled:opacity-40"
            >
              {requested ? "Requested!" : "♡ Request Whole Deck"}
            </button>
          </div>
        </div>
      )}

      {/* Card grid */}
      {result && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-zinc-500">Deck Contents</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {result.entries.map((e, i) => {
              const haveQty = e.card
                ? result.available.find((a) => a.card.id === e.card!.id)?.qty ?? 0
                : 0;
              const outOfStock = haveQty === 0;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div
                    className="relative w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg"
                    style={{ aspectRatio: "3/4" }}
                  >
                    {e.card ? (
                      <Image
                        src={e.card.image}
                        alt={e.card.name}
                        fill
                        sizes="160px"
                        className={`object-cover transition-all ${outOfStock ? "grayscale opacity-40" : ""}`}
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-zinc-600">
                        Not in catalog
                      </div>
                    )}
                    {outOfStock && e.card && (
                      <div className="absolute inset-x-0 bottom-0 bg-zinc-950/80 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-red-400">
                        Out of stock
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-1 w-full text-center text-[11px] text-zinc-300" title={e.cardName}>
                    {e.cardName}
                  </p>
                  <p className="text-[11px] font-bold text-purple-400">×{e.qty}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In stock / missing split */}
      {result && (result.available.length > 0 || result.missing.length > 0) && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {result.available.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-3 text-sm font-bold text-green-400">In Stock → Cart</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.available.map((a) => (
                  <li key={a.card.id} className="flex justify-between">
                    <span>{a.card.name}</span>
                    <span className="text-zinc-500">×{a.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.missing.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-3 text-sm font-bold text-yellow-400">Missing → Wishlist</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.missing.map((m, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{m.cardName}</span>
                    <span className="text-zinc-500">×{m.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {added && (
        <p className="mt-4 text-sm text-zinc-500">
          In-stock cards added to your cart. Missing cards are on your wishlist — we&apos;ll source them for you.
        </p>
      )}
    </div>
  );
}
