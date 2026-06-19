"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { Card, WishlistLine } from "@/lib/types";

const DECK_REQUEST_PREFIX = "Deck request:";
const DECK_IMPORT_PREFIX = "from deck import:";
const CARD_REQUEST_NOTE = "Card request";

function isDeckRelated(line: WishlistLine): boolean {
  return (
    line.note?.startsWith(DECK_REQUEST_PREFIX) ||
    line.note?.startsWith(DECK_IMPORT_PREFIX) ||
    false
  );
}

function isCardRequest(line: WishlistLine): boolean {
  return line.note === CARD_REQUEST_NOTE;
}

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useStore();
  const [catalog, setCatalog] = useState<Map<string, Card>>(new Map());

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => setCatalog(new Map((data.cards ?? []).map((c: Card) => [c.id, c]))));
  }, []);

  if (wishlist.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">Your wishlist is empty</h1>
        <p className="mt-2 text-zinc-400">
          Add individual cards any time, or request a whole deck from the deck importer.
        </p>
        <Link href="/vibes/deck-import" className="mt-4 inline-block text-purple-400 hover:underline">
          Import a deck →
        </Link>
      </div>
    );
  }

  const indexed = wishlist.map((line, i) => ({ line, i }));
  const individual = indexed.filter(({ line }) => !isDeckRelated(line) && !isCardRequest(line));
  const cardRequests = indexed.filter(({ line }) => isCardRequest(line));
  const deckRequests = indexed.filter(({ line }) => isDeckRelated(line));

  function stockBadge(line: WishlistLine) {
    if (!line.cardId) return null;
    const card = catalog.get(line.cardId);
    if (!card) return null;
    return card.stock > 0 ? (
      <span className="ml-2 text-xs text-green-400">In stock</span>
    ) : (
      <span className="ml-2 text-xs text-red-400">Out of stock</span>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Your Wishlist</h1>
      <p className="mt-2 text-sm text-zinc-400">
        I&apos;ll hunt these down and follow up when they&apos;re available.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Wishlist ({individual.length})
        </h2>
        {individual.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet — tap the ♡ on any card.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {individual.map(({ line, i }) => (
              <li key={i} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-zinc-100">{line.qty}x {line.cardName}</p>
                <button onClick={() => removeFromWishlist(i)} className="text-sm text-red-400 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Card Requests ({cardRequests.length})
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Cards you asked me to source because they were out of stock.
        </p>
        {cardRequests.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet — tap &quot;Request card&quot; on an out-of-stock card.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {cardRequests.map(({ line, i }) => (
              <li key={i} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-zinc-100">{line.qty}x {line.cardName}</p>
                <button onClick={() => removeFromWishlist(i)} className="text-sm text-red-400 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Deck Requests ({deckRequests.length})
        </h2>
        {deckRequests.length === 0 ? (
          <p className="text-sm text-zinc-500">
            None yet — use &quot;Request entire deck&quot; on the deck importer.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {deckRequests.map(({ line, i }) => (
              <li key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-zinc-100">
                    {line.qty}x {line.cardName}
                    {stockBadge(line)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {line.note?.replace(DECK_REQUEST_PREFIX, "").replace(DECK_IMPORT_PREFIX, "").trim()}
                  </p>
                </div>
                <button onClick={() => removeFromWishlist(i)} className="text-sm text-red-400 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
