"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/lib/types";
import { useStore } from "@/context/StoreContext";
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
  Purple: "ring-purple-500/40",
  Blue: "ring-blue-500/40",
  Red: "ring-red-500/40",
  Green: "ring-green-500/40",
  Yellow: "ring-yellow-500/40",
  Colorless: "ring-zinc-500/40",
  Relic: "ring-amber-500/40",
  Rod: "ring-amber-500/40",
  "Multi-color": "ring-fuchsia-500/40",
};
function ringFor(card: Card): string {
  return COLOR_RING[colorCategory(card)] ?? "ring-zinc-500/40";
}

const RARITY_CHIP: Record<string, string> = {
  Common: "border-zinc-600 bg-zinc-700/40 text-zinc-300",
  Uncommon: "border-green-600 bg-green-900/40 text-green-300",
  Rare: "border-blue-500 bg-blue-900/40 text-blue-300",
  Epic: "border-purple-500 bg-purple-900/40 text-purple-300",
};

const VARIANT_LABEL: Record<string, string> = { foil: "Foil", altfoil: "Alt Foil" };

// Loading placeholder matching the tile footprint (no layout shift).
export function CardTileSkeleton() {
  return (
    <div className="flex animate-pulse flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="mb-3 rounded-xl bg-zinc-800" style={{ aspectRatio: "3/4" }} />
      <div className="mb-2 h-4 w-3/4 rounded bg-zinc-800" />
      <div className="mb-3 h-3 w-1/2 rounded bg-zinc-800" />
      <div className="mb-3 h-5 w-1/3 rounded bg-zinc-800" />
      <div className="h-9 rounded-lg bg-zinc-800" />
    </div>
  );
}

export default function CardTile({
  card,
  getQtyInDeck,
  onAdd,
  getMarketPrices,
  variants = {},
  preferredVariant = null,
}: {
  card: Card;
  getQtyInDeck: (id: string) => number;
  onAdd: (cardId: string) => void;
  getMarketPrices: (id: string) => MarketPrice[];
  variants?: Partial<Record<VariantKind, VariantInfo>>;
  preferredVariant?: VariantKind | null;
}) {
  const { addToCart, addToWishlist } = useStore();
  const available = (Object.keys(variants) as VariantKind[]).filter((k) => variants[k]);
  const initialSelected: "base" | VariantKind =
    preferredVariant && variants[preferredVariant] ? preferredVariant : "base";
  const [selected, setSelected] = useState<"base" | VariantKind>(initialSelected);
  const [flash, setFlash] = useState<"" | "cart" | "wish" | "deck">("");

  useEffect(() => {
    setSelected(preferredVariant && variants[preferredVariant] ? preferredVariant : "base");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredVariant, card.id]);

  const activeVariant = selected !== "base" ? variants[selected] : undefined;
  const showingVariant = selected !== "base" && !!activeVariant;
  const selectedId = showingVariant ? `${card.id}::${selected}` : card.id;
  const price = showingVariant ? activeVariant!.price : card.price;
  const stock = showingVariant ? activeVariant!.stock : card.stock;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 5;
  const marketPrices = getMarketPrices(selectedId);
  const banned = !!card.banned;
  const isFoil = showingVariant || !!card.isFoil;
  const isGraded = !!card.isSpecial || !!card.grade;

  function ping(kind: "cart" | "wish" | "deck") {
    setFlash(kind);
    setTimeout(() => setFlash(""), 1200);
  }

  return (
    <div
      className={`group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-3 ring-1 ${ringFor(card)} transition duration-200 hover:-translate-y-1 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40`}
    >
      <Link href={`/vibes/cards/${card.id}`} className="flex-1">
        <div className="relative mb-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950" style={{ aspectRatio: "3/4" }}>
          <Image
            src={card.image}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 50vw, 260px"
            style={{ transform: "scale(1.04)" }}
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.07] ${!inStock ? "grayscale opacity-40" : ""} ${isFoil ? "drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]" : ""}`}
            unoptimized
          />
          {/* Top-left badges */}
          <div className="absolute left-1.5 top-1.5 z-10 flex flex-col gap-1">
            {banned && (
              <span title="Banned in competitive play" className="rounded-md bg-red-600/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">⛔ Banned</span>
            )}
            {isGraded && (
              <span className="rounded-md bg-amber-500/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow">{card.grade ? `Graded ${card.grade}` : "Graded"}</span>
            )}
            {isFoil && !isGraded && (
              <span className="rounded-md bg-purple-600/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">✨ Foil</span>
            )}
          </div>
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-8deg] rounded border-2 border-red-500 px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-red-500">Out of Stock</span>
            </div>
          )}
        </div>
        <h3 className="truncate text-base font-semibold text-zinc-100" title={card.name}>{card.name}</h3>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="truncate text-xs text-zinc-500">{card.set}</span>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${RARITY_CHIP[card.rarity] ?? "border-zinc-700 bg-zinc-800/50 text-zinc-300"}`}>{card.rarity}</span>
        </div>
      </Link>

      {available.length > 0 && (
        <div className="mt-2 flex rounded-full border border-zinc-700 p-0.5 text-[11px]">
          <button onClick={() => setSelected("base")} className={`flex-1 rounded-full py-1 ${selected === "base" ? "bg-purple-600 text-white" : "text-zinc-400"}`}>Base</button>
          {available.map((kind) => (
            <button key={kind} onClick={() => setSelected(kind)} className={`flex-1 rounded-full py-1 ${selected === kind ? "bg-purple-600 text-white" : "text-zinc-400"}`}>{VARIANT_LABEL[kind]}</button>
          ))}
        </div>
      )}

      {/* Price + stock */}
      <div className="mt-3 flex items-end justify-between">
        <span className="text-xl font-bold tabular-nums text-purple-300">${price.toFixed(2)}</span>
        {/* Change pill slot — shown in Phase 2 once price history exists. */}
      </div>
      <p className={`mt-0.5 text-xs font-medium ${!inStock ? "text-zinc-500" : lowStock ? "text-amber-400" : "text-green-400"}`}>
        {!inStock ? "Out of stock — add to wishlist" : lowStock ? `Low stock: ${stock}` : `${stock} in stock`}
      </p>

      {marketPrices.length > 0 && (
        <p className="mt-1 text-[11px] text-zinc-500">
          Market: {marketPrices.map((mp) => `${mp.label} $${mp.price.toFixed(2)}`).join(" · ")}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {inStock ? (
          <button
            onClick={() => { addToCart(selectedId, 1); ping("cart"); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            {flash === "cart" ? "✓ Added" : "Add to Cart"}
          </button>
        ) : (
          <button
            onClick={() => { addToWishlist([{ cardName: card.name, cardId: selectedId, qty: 1, note: "Card request" }]); ping("wish"); }}
            className="flex flex-1 items-center justify-center rounded-lg bg-zinc-700 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-600"
          >
            {flash === "wish" ? "✓ Requested" : "Request Card"}
          </button>
        )}
        <button
          onClick={() => { addToWishlist([{ cardName: card.name, cardId: selectedId, qty: 1 }]); ping("wish"); }}
          title="Add to wishlist"
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-pink-500 hover:text-pink-400"
        >
          {flash === "wish" ? "♥" : "♡"}
        </button>
      </div>
      <button
        onClick={() => { onAdd(selectedId); ping("deck"); }}
        className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 py-1.5 text-xs text-zinc-400 transition hover:border-purple-600 hover:text-purple-300"
      >
        {flash === "deck" ? "✓ Added to deck" : "＋ Add to deck"}
        {getQtyInDeck(selectedId) > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold">{getQtyInDeck(selectedId)}</span>
        )}
      </button>
    </div>
  );
}
