"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/lib/types";

interface MarketPrice {
  source: string;
  label: string;
  price: number;
  currency: string;
}

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

const SOURCE_LOGO: Record<string, { src: string; width: number; height: number }> = {
  dyli: { src: "/logos/dyli-logo.png", width: 32, height: 12 },
  minmax: { src: "/logos/minmax-logo.png", width: 30, height: 12 },
};

export default function CardTile({
  card,
  qtyInDeck = 0,
  onAdd,
  marketPrices = [],
}: {
  card: Card;
  qtyInDeck?: number;
  onAdd: (cardId: string) => void;
  marketPrices?: MarketPrice[];
}) {
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
      {marketPrices.length > 0 && (
        <div className="mt-1 space-y-1">
          {marketPrices.map((mp) => {
            const logo = SOURCE_LOGO[mp.source];
            return (
              <div key={mp.source} className="flex items-center justify-between text-[11px] text-zinc-400">
                {logo ? (
                  <Image src={logo.src} alt={mp.label} width={logo.width} height={logo.height} className="opacity-80" />
                ) : (
                  <span>{mp.label}</span>
                )}
                <span>${mp.price.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={() => onAdd(card.id)}
        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-purple-600 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
      >
        Add to deck
        {qtyInDeck > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-xs font-bold">{qtyInDeck}</span>
        )}
      </button>
    </div>
  );
}
