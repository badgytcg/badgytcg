"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/lib/types";
import { useStore } from "@/context/StoreContext";
import { colorCategory } from "@/lib/colors";

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
const VARIANT_COL_KEYS = ["base", "foil", "altfoil"] as const;
type ColKey = (typeof VARIANT_COL_KEYS)[number];
const COL_LABEL: Record<ColKey, string> = { base: "Base", foil: "Foil", altfoil: "Alt Foil" };

const SOURCE_LOGO: Record<string, { src: string; width: number; height: number }> = {
  dyli: { src: "/logos/dyli-logo.png", width: 48, height: 18 },
  minmax: { src: "/logos/minmax-logo.png", width: 44, height: 18 },
};

const SOURCE_ACCENT: Record<string, string> = {
  dyli: "bg-yellow-400",
  minmax: "bg-purple-500",
};

interface HistoryPoint {
  source: string;
  price: number;
  recordedAt: string;
}

const CHART_COLOR: Record<string, string> = {
  dyli: "#facc15",
  minmax: "#a855f7",
  site: "#34d399",
};

function PriceChart({ history }: { history: HistoryPoint[] }) {
  const bySource = new Map<string, HistoryPoint[]>();
  for (const p of history) {
    const list = bySource.get(p.source);
    if (list) list.push(p);
    else bySource.set(p.source, [p]);
  }
  const series = Array.from(bySource.entries()).filter(([, pts]) => pts.length >= 2);
  if (series.length === 0) return null;

  const allPrices = history.map((p) => p.price);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;
  const width = 320;
  const height = 80;

  function pointsFor(pts: HistoryPoint[]) {
    return pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * width;
        const y = height - ((p.price - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Price History</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 80 }}>
        {series.map(([source, pts]) => (
          <polyline
            key={source}
            points={pointsFor(pts)}
            fill="none"
            stroke={CHART_COLOR[source] ?? "#a1a1aa"}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-zinc-400">
        {series.map(([source]) => (
          <span key={source} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLOR[source] ?? "#a1a1aa" }} />
            {source === "site" ? "BadgyTCG" : source === "dyli" ? "Dyli" : "MinMax"}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-zinc-100">{value ?? "—"}</p>
    </div>
  );
}

// Parses ability text tokens:
//   [ACT]  → "ACT" pill badge
//   _F_    → ↷ curved-arrow cost icon (the "flip/tap" action cost in Vibes TCG)
//   newlines → <br />
function AbilityText({ text }: { text: string }) {
  const parts = text.split(/(\[ACT\]|_F_|\n)/g);
  return (
    <p className="text-sm leading-relaxed text-zinc-200">
      {parts.map((part, i) => {
        if (part === "[ACT]")
          return (
            <span key={i} className="inline-flex items-center rounded bg-purple-800/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 mr-1">
              ACT
            </span>
          );
        if (part === "_F_")
          return (
            <span key={i} className="inline-flex items-center justify-center rounded-full border border-purple-500 text-purple-300 mx-0.5" style={{ width: 18, height: 18, fontSize: 12, lineHeight: 1 }}>
              ↷
            </span>
          );
        if (part === "\n") return <br key={i} />;
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function CardDetail({ card }: { card: Card }) {
  const { addToCart, addToWishlist } = useStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [marketPricesById, setMarketPricesById] = useState<Record<string, MarketPrice[]>>({});
  const [historyById, setHistoryById] = useState<Record<string, HistoryPoint[]>>({});
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

  // Fetch market prices for base + all variants simultaneously so we can
  // display a complete table (Base | Foil | Alt Foil columns) at once.
  useEffect(() => {
    const ids = [card.id, `${card.id}::foil`, `${card.id}::altfoil`];
    for (const id of ids) {
      fetch(`/api/cards/${encodeURIComponent(id)}/market-prices`)
        .then((res) => res.json())
        .then((data) => setMarketPricesById((prev) => ({ ...prev, [id]: data.prices ?? [] })));
    }
  }, [card.id]);

  useEffect(() => {
    fetch(`/api/cards/${encodeURIComponent(selected.id)}/market-prices/history`)
      .then((res) => res.json())
      .then((data) => setHistoryById((prev) => ({ ...prev, [selected.id]: data.history ?? [] })));
  }, [selected.id]);

  const history = historyById[selected.id] ?? [];

  // Build a source→colKey→price lookup for the market prices table.
  const allSources = Array.from(
    new Set(Object.values(marketPricesById).flatMap((arr) => arr.map((p) => p.source)))
  );
  function getPriceForCol(source: string, colKey: ColKey): MarketPrice | undefined {
    const id = colKey === "base" ? card.id : `${card.id}::${colKey}`;
    return (marketPricesById[id] ?? []).find((p) => p.source === source);
  }

  const colorLabel = colorCategory(card);
  const tags = [card.type, card.attribute, card.rarity].filter(Boolean) as string[];

  const RARITY_COLOR: Record<string, string> = {
    Common: "border-zinc-600 text-zinc-400",
    Uncommon: "border-green-600 text-green-400",
    Rare: "border-blue-500 text-blue-400",
    Epic: "border-purple-500 text-purple-400",
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="grid gap-10 sm:grid-cols-[300px_1fr]">
        {/* Card image — no padding so the card fills edge-to-edge */}
        <div className="relative overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: "3/4", background: "#000" }}>
          <Image
            src={selected.image}
            alt={selected.name}
            fill
            sizes="300px"
            className={`object-cover transition-all ${!inStock ? "grayscale opacity-40" : ""} ${selectedVariant !== "base" ? "drop-shadow-[0_0_24px_rgba(168,85,247,0.6)]" : ""}`}
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

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Title + tags */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{card.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium ${RARITY_COLOR[tag] ?? "border-zinc-700 text-zinc-400"}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Color" value={colorLabel} />
            <StatBox label="Cost" value={card.cost} />
            <StatBox label="Vibe" value={card.vibe} />
            <StatBox label="Set" value={card.set} />
          </div>

          {/* Ability */}
          {card.ability && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-purple-400">Ability</p>
              <AbilityText text={card.ability} />
            </div>
          )}

          {/* Variant toggle */}
          {availableVariants.length > 0 && (
            <div className="inline-flex self-start rounded-full border border-zinc-700 bg-zinc-900 p-1 text-sm">
              <button
                onClick={() => setSelectedVariant("base")}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${selectedVariant === "base" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                Base
              </button>
              {availableVariants.map((kind) => (
                <button
                  key={kind}
                  onClick={() => setSelectedVariant(kind)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${selectedVariant === kind ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  {VARIANT_LABEL[kind]}
                </button>
              ))}
            </div>
          )}

          {/* Price + buy */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-3xl font-bold text-purple-300">${selected.price.toFixed(2)}</p>
              <p className={`mt-0.5 text-sm ${inStock ? "text-green-400" : "text-zinc-500"}`}>
                {inStock ? `${selected.stock} in stock` : "Out of stock"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              {inStock ? (
                <button
                  onClick={() => { addToCart(selected.id, qty); setAdded(true); setTimeout(() => setAdded(false), 1500); }}
                  className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-500"
                >
                  Add to Cart
                </button>
              ) : (
                <button
                  onClick={() => { addToWishlist([{ cardName: selected.name, cardId: selected.id, qty, note: "Card request" }]); setAdded(true); setTimeout(() => setAdded(false), 1500); }}
                  className="rounded-lg bg-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-600"
                >
                  Request Card
                </button>
              )}
              <button
                onClick={() => { addToWishlist([{ cardName: selected.name, cardId: selected.id, qty }]); setAdded(true); setTimeout(() => setAdded(false), 1500); }}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300"
              >
                ♡ Wishlist
              </button>
              {added && <span className="text-sm text-green-400">Added!</span>}
            </div>
          </div>

          {/* Market prices table — Base / Foil / Alt Foil columns */}
          {allSources.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <p className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Market Prices
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                    <th className="px-4 py-2 text-left"></th>
                    {VARIANT_COL_KEYS.map((col) => (
                      <th key={col} className="px-3 py-2 font-medium">{COL_LABEL[col]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {allSources.map((source) => {
                    const logo = SOURCE_LOGO[source];
                    const accent = SOURCE_ACCENT[source] ?? "bg-zinc-600";
                    return (
                      <tr key={source}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-3 w-1 rounded-full ${accent}`} />
                            {logo ? (
                              <Image src={logo.src} alt={source} width={logo.width} height={logo.height} />
                            ) : (
                              <span className="text-xs text-zinc-400">{source}</span>
                            )}
                          </div>
                        </td>
                        {VARIANT_COL_KEYS.map((col) => {
                          const mp = getPriceForCol(source, col);
                          return (
                            <td key={col} className="px-3 py-3 text-right">
                              {mp ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-medium text-zinc-100">${mp.price.toFixed(2)}</span>
                                  {mp.url && (
                                    <a
                                      href={mp.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded bg-purple-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-purple-600"
                                    >
                                      Buy →
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <PriceChart history={history} />
        </div>
      </div>
    </div>
  );
}
