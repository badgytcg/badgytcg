"use client";

import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { WishlistLine } from "@/lib/types";

const DECK_REQUEST_PREFIX = "Deck request:";

function isDeckRequest(line: WishlistLine): boolean {
  return line.note?.startsWith(DECK_REQUEST_PREFIX) ?? false;
}

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useStore();

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
  const individual = indexed.filter(({ line }) => !isDeckRequest(line));
  const deckRequests = indexed.filter(({ line }) => isDeckRequest(line));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Your Wishlist</h1>
      <p className="mt-2 text-sm text-zinc-400">
        I&apos;ll hunt these down and follow up when they&apos;re available.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Individual Cards ({individual.length})
        </h2>
        {individual.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet — add a card from any card page.</p>
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
                  <p className="text-sm text-zinc-100">{line.qty}x {line.cardName}</p>
                  <p className="text-xs text-zinc-500">{line.note?.replace(DECK_REQUEST_PREFIX, "").trim()}</p>
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
