"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/lib/types";
import { useStore } from "@/context/StoreContext";

export default function CardDetail({ card }: { card: Card }) {
  const { addToCart, addToWishlist } = useStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const inStock = card.stock > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="relative h-96 overflow-hidden rounded-xl bg-zinc-800">
          <Image
            src={card.image}
            alt={card.name}
            fill
            sizes="400px"
            className={`object-contain ${!inStock ? "grayscale opacity-40" : ""}`}
            unoptimized
          />
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-8deg] rounded border-2 border-red-500 px-4 py-1 text-lg font-bold uppercase tracking-wide text-red-500">
                Out of Stock
              </span>
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{card.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">{card.set} · {card.rarity} · {card.color}</p>
          {card.cost !== null && (
            <p className="mt-1 text-sm text-zinc-400">Cost {card.cost} · Vibe {card.vibe}</p>
          )}
          {card.ability && (
            <p className="mt-3 whitespace-pre-line rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300">
              {card.ability}
            </p>
          )}
          <p className="mt-4 text-2xl font-semibold text-purple-300">${card.price.toFixed(2)}</p>
          <p className={`mt-1 text-sm ${inStock ? "text-green-400" : "text-zinc-500"}`}>
            {inStock ? `${card.stock} in stock` : "Out of stock"}
          </p>

          <div className="mt-6 flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
            {inStock ? (
              <button
                onClick={() => {
                  addToCart(card.id, qty);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1500);
                }}
                className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
              >
                Add to cart
              </button>
            ) : (
              <button
                onClick={() => {
                  addToWishlist([{ cardName: card.name, cardId: card.id, qty }]);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1500);
                }}
                className="rounded-lg bg-zinc-700 px-5 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
              >
                Request card
              </button>
            )}
            <button
              onClick={() => {
                addToWishlist([{ cardName: card.name, cardId: card.id, qty }]);
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
              className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300"
            >
              ♡ Wishlist
            </button>
            {added && <span className="text-sm text-green-400">Added!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
