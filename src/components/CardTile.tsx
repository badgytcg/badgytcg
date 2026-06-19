"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/lib/types";
import { useStore } from "@/context/StoreContext";

const COLOR_RING: Record<string, string> = {
  Purple: "ring-purple-500/50",
  Blue: "ring-blue-500/50",
  Red: "ring-red-500/50",
  Green: "ring-green-500/50",
  Yellow: "ring-yellow-500/50",
  Colorless: "ring-zinc-500/50",
  Relic: "ring-amber-500/50",
  Rod: "ring-amber-500/50",
};

function ringFor(color: string): string {
  // Dual colors like "Blue Yellow" key off the first color.
  const first = color.split(" ")[0];
  return COLOR_RING[first] ?? "ring-zinc-500/50";
}

export default function CardTile({ card }: { card: Card }) {
  const { addToCart, addToWishlist } = useStore();
  const inStock = card.stock > 0;

  return (
    <div
      className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-4 ring-1 ${ringFor(card.color)}`}
    >
      <Link href={`/vibes/cards/${card.id}`} className="flex-1">
        <div className="relative mb-3 h-40 overflow-hidden rounded-lg bg-zinc-800">
          <Image
            src={card.image}
            alt={card.name}
            fill
            sizes="200px"
            className={`object-contain ${!inStock ? "grayscale opacity-40" : ""}`}
            unoptimized
          />
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-8deg] rounded border-2 border-red-500 px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-red-500">
                Out of Stock
              </span>
            </div>
          )}
        </div>
        <h3 className="font-semibold text-zinc-100">{card.name}</h3>
        <p className="text-xs text-zinc-500">{card.set} · {card.rarity}</p>
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-medium text-purple-300">${card.price.toFixed(2)}</span>
        <span className={`text-xs ${inStock ? "text-green-400" : "text-zinc-500"}`}>
          {inStock ? `${card.stock} in stock` : "Out of stock"}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        {inStock ? (
          <button
            onClick={() => addToCart(card.id, 1)}
            className="flex-1 rounded-lg bg-purple-600 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
          >
            Add to cart
          </button>
        ) : (
          <button
            onClick={() => addToWishlist([{ cardName: card.name, cardId: card.id, qty: 1, note: "Card request" }])}
            className="flex-1 rounded-lg bg-zinc-700 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
          >
            Request card
          </button>
        )}
        <button
          onClick={() => addToWishlist([{ cardName: card.name, cardId: card.id, qty: 1 }])}
          title="Add to wishlist"
          className="rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-purple-500 hover:text-purple-300"
        >
          ♡
        </button>
      </div>
    </div>
  );
}
