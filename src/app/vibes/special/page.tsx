"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/lib/types";
import { useStore } from "@/context/StoreContext";

export default function SpecialCardsPage() {
  const { addToCart, addToWishlist } = useStore();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/special-cards")
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setLoading(false);
      });
  }, []);

  function flashAdded(id: string) {
    setAddedId(id);
    setTimeout(() => setAddedId(null), 1500);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Graded Cards &amp; Promos</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Graded slabs and promo cards — only what&apos;s actually in hand right now.
      </p>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : cards.length === 0 ? (
        <p className="text-zinc-500">Nothing listed right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.id} className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-4 ring-1 ring-purple-500/30">
              <div className="relative mb-3 h-40 overflow-hidden rounded-lg bg-zinc-800">
                <Image src={card.image} alt={card.name} fill sizes="200px" className="object-contain" unoptimized />
              </div>
              <h3 className="font-semibold text-zinc-100">{card.name}</h3>
              <p className="text-xs text-zinc-500">{card.grade ?? card.rarity} · {card.set}</p>
              {card.description && <p className="mt-1 text-xs text-zinc-400">{card.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="font-medium text-purple-300">${card.price.toFixed(2)}</span>
                <span className="text-xs text-green-400">
                  {card.stock > 1 ? `${card.stock} in stock` : "In stock"}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    addToCart(card.id, 1);
                    flashAdded(card.id);
                  }}
                  className="flex-1 rounded-lg bg-purple-600 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
                >
                  {addedId === card.id ? "Added!" : "Add to cart"}
                </button>
                <button
                  onClick={() => addToWishlist([{ cardName: card.name, cardId: card.id, qty: 1 }])}
                  title="Add to wishlist"
                  className="rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                >
                  ♡
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
