"use client";

import Link from "next/link";
import { useStore } from "@/context/StoreContext";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useStore();

  if (wishlist.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">Your wishlist is empty</h1>
        <p className="mt-2 text-zinc-400">
          Cards that are out of stock, or missing from an imported deck, show up here.
        </p>
        <Link href="/vibes/deck-import" className="mt-4 inline-block text-purple-400 hover:underline">
          Import a deck →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Your Wishlist</h1>
      <p className="mt-2 text-sm text-zinc-400">
        These are cards I don&apos;t currently have in stock. I&apos;ll hunt them down and
        follow up when they&apos;re available.
      </p>
      <ul className="mt-6 divide-y divide-zinc-800">
        {wishlist.map((line, i) => (
          <li key={i} className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-zinc-100">{line.qty}x {line.cardName}</p>
              {line.note && <p className="text-xs text-zinc-500">{line.note}</p>}
            </div>
            <button onClick={() => removeFromWishlist(i)} className="text-sm text-red-400 hover:underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
