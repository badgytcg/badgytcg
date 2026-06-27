"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/lib/types";
import { useStore } from "@/context/StoreContext";

interface MarketPrice {
  source: string;
  label: string;
  price: number;
  currency: string;
  url: string | null;
  updatedAt: string;
}

type VariantKind = "foil" | "altfoil";
const VARIANT_LABEL: Record<VariantKind, string> = { foil: "Foil", altfoil: "Alt Foil" };
const VARIANT_KINDS: VariantKind[] = ["foil", "altfoil"];

const SOURCE_LOGO: Record<string, { src: string; width: number; height: number }> = {
  dyli: { src: "/logos/dyli-logo.png", width: 48, height: 18 },
  minmax: { src: "/logos/minmax-logo.png", width: 44, height: 18 },
};

export default function CardDetail({ card }: { card: Card }) {
  const { addToCart, addToWishlist } = useStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [marketPricesById, setMarketPricesById] = useState<Record<string, MarketPrice[]>>({});
  const [variantCards, setVariantCards] = useState<Partial<Record<VariantKind, Card>>>({});
  const [selectedVariant, setSelectedVariant] = useState<"base" | VariantKind>("base");

  useEffect(() => {
    setSelectedVariant("base");
    setVariantCards({});

    for (const kind of VARIANT_KINDS) {
      fetch(`/api/cards/${encodeURIComponent(`${card.id}::${kind}`)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.card) setVariantCards((prev) => ({ ...prev, [kind]: data.card }));
        });
    }
  }, [card.id]);

  const selected = selectedVariant !== "base" ? variantCards[selectedVariant] ?? card : card;
  const inStock = selected.stock > 0;
  const availableVariants = VARIANT_KINDS.filter((k) => variantCards[k]);

  useEffect(() => {
    fetch(`/api/cards/${encodeURIComponent(selected.id)}/market-prices`)
      .then((res) => res.json())
      .then((data) => setMarketPricesById((prev) => ({ ...prev, [selected.id]: data.prices ?? [] })));
  }, [selected.id]);

  const marketPrices = marketPricesById[selected.id] ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="relative h-96 overflow-hidden rounded-xl bg-zinc-800">
          <Image
            src={selected.image}
            alt={selected.name}
            fill
            sizes="400px"
            className={`object-contain ${!inStock ? "grayscale opacity-40" : ""} ${selectedVariant !== "base" ? "drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]" : ""}`}
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

          {availableVariants.length > 0 && (
            <div className="mt-4 inline-flex rounded-full border border-zinc-700 p-1 text-sm">
              <button
                onClick={() => setSelectedVariant("base")}
                className={`rounded-full px-3 py-1 ${selectedVariant === "base" ? "bg-purple-600 text-white" : "text-zinc-400"}`}
              >
                Base
              </button>
              {availableVariants.map((kind) => (
                <button
                  key={kind}
                  onClick={() => setSelectedVariant(kind)}
                  className={`rounded-full px-3 py-1 ${selectedVariant === kind ? "bg-purple-600 text-white" : "text-zinc-400"}`}
                >
                  {VARIANT_LABEL[kind]}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-2xl font-semibold text-purple-300">${selected.price.toFixed(2)}</p>
          <p className={`mt-1 text-sm ${inStock ? "text-green-400" : "text-zinc-500"}`}>
            {inStock ? `${selected.stock} in stock` : "Out of stock"}
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
                  addToCart(selected.id, qty);
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
                  addToWishlist([{ cardName: selected.name, cardId: selected.id, qty, note: "Card request" }]);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1500);
                }}
                className="rounded-lg bg-zinc-700 px-5 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
              >
                Request {selectedVariant === "base" ? "card" : VARIANT_LABEL[selectedVariant].toLowerCase()}
              </button>
            )}
            <button
              onClick={() => {
                addToWishlist([{ cardName: selected.name, cardId: selected.id, qty }]);
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
              className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300"
            >
              ♡ Wishlist
            </button>
            {added && <span className="text-sm text-green-400">Added!</span>}
          </div>

          {marketPrices.length > 0 && (
            <div className="mt-6 rounded-lg border border-zinc-800 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Market Prices Elsewhere
              </h3>
              <ul className="space-y-2 text-sm">
                {marketPrices.map((mp) => {
                  const logo = SOURCE_LOGO[mp.source];
                  return (
                    <li key={mp.source} className="flex items-center justify-between">
                      {logo ? (
                        <Image src={logo.src} alt={mp.label} width={logo.width} height={logo.height} />
                      ) : (
                        <span className="text-zinc-400">{mp.label}</span>
                      )}
                      {mp.url ? (
                        <a href={mp.url} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">
                          {mp.price.toFixed(2)} {mp.currency}
                        </a>
                      ) : (
                        <span className="text-zinc-200">{mp.price.toFixed(2)} {mp.currency}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
