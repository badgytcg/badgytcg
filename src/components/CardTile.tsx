"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/lib/types";
import { colorCategory } from "@/lib/colors";

interface MarketPrice {
  source: string;
  label: string;
  price: number;
  currency: string;
}

interface VariantInfo {
  price: number;
  stock: number;
}

type VariantKind = "foil" | "altfoil";

const COLOR_RING: Record<string, string> = {
  Purple: "ring-purple-500/50",
  Blue: "ring-blue-500/50",
  Red: "ring-red-500/50",
  Green: "ring-green-500/50",
  Yellow: "ring-yellow-500/50",
  Colorless: "ring-zinc-500/50",
  Relic: "ring-amber-500/50",
  Rod: "ring-amber-500/50",
  "Multi-color": "ring-fuchsia-500/50",
};

function ringFor(card: Card): string {
  return COLOR_RING[colorCategory(card)] ?? "ring-zinc-500/50";
}

const SOURCE_LOGO: Record<string, { src: string; width: number; height: number }> = {
  dyli: { src: "/logos/dyli-logo.png", width: 32, height: 12 },
  minmax: { src: "/logos/minmax-logo.png", width: 30, height: 12 },
};

const VARIANT_LABEL: Record<VariantKind, string> = { foil: "Foil", altfoil: "Alt Foil" };

export default function CardTile({
  card,
  getQtyInDeck,
  onAdd,
  getMarketPrices,
  variants = {},
}: {
  card: Card;
  getQtyInDeck: (id: string) => number;
  onAdd: (cardId: string) => void;
  getMarketPrices: (id: string) => MarketPrice[];
  variants?: Partial<Record<VariantKind, VariantInfo>>;
}) {
  const [selected, setSelected] = useState<"base" | VariantKind>("base");
  const available = (Object.keys(variants) as VariantKind[]).filter((k) => variants[k]);

  const activeVariant = selected !== "base" ? variants[selected] : undefined;
  const showingVariant = selected !== "base" && !!activeVariant;
  const selectedId = showingVariant ? `${card.id}::${selected}` : card.id;
  const price = showingVariant ? activeVariant!.price : card.price;
  const stock = showingVariant ? activeVariant!.stock : card.stock;
  const inStock = stock > 0;
  const marketPrices = getMarketPrices(selectedId);

  return (
    <div
      className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-4 ring-1 ${ringFor(card)}`}
    >
      <Link href={`/vibes/cards/${card.id}`} className="flex-1">
        <div className="relative mb-3 h-40 overflow-hidden rounded-lg bg-zinc-800">
          <Image
            src={card.image}
            alt={card.name}
            fill
            sizes="200px"
            className={`object-contain ${!inStock ? "grayscale opacity-40" : ""} ${showingVariant ? "drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]" : ""}`}
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

      {available.length > 0 && (
        <div className="mt-2 flex rounded-full border border-zinc-700 p-0.5 text-xs">
          <button
            onClick={() => setSelected("base")}
            className={`flex-1 rounded-full py-1 ${selected === "base" ? "bg-purple-600 text-white" : "text-zinc-400"}`}
          >
            Base
          </button>
          {available.map((kind) => (
            <button
              key={kind}
              onClick={() => setSelected(kind)}
              className={`flex-1 rounded-full py-1 ${selected === kind ? "bg-purple-600 text-white" : "text-zinc-400"}`}
            >
              {VARIANT_LABEL[kind]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="font-medium text-purple-300">${price.toFixed(2)}</span>
        <span className={`text-xs ${inStock ? "text-green-400" : "text-zinc-500"}`}>
          {inStock ? `${stock} in stock` : "Out of stock"}
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
        onClick={() => onAdd(selectedId)}
        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-purple-600 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
      >
        Add to deck
        {getQtyInDeck(selectedId) > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-xs font-bold">{getQtyInDeck(selectedId)}</span>
        )}
      </button>
    </div>
  );
}
