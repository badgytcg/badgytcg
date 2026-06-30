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
  scg: { src: "/logos/scg-logo.png", width: 48, height: 18 },
};

const SOURCE_LABEL: Record<string, string> = {
  site: "BadgyTCG",
  dyli: "Dyli",
  minmax: "MinMax",
  scg: "StarCityGames",
};

const DYLI_AFFILIATE = "https://www.dyli.io/?code=km7g2673";

const SOURCE_ACCENT: Record<string, string> = {
  dyli: "bg-yellow-400",
  minmax: "bg-purple-500",
  scg: "bg-blue-500",
};

interface HistoryPoint {
  source: string;
  price: number;
  recordedAt: string;
}

const CHART_COLOR: Record<string, string> = {
  dyli: "#facc15",
  minmax: "#a855f7",
  scg: "#3b82f6",
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
  const height = 100;
  const padTop = 8;
  const padBottom = 18; // room for the x-axis date labels
  const plotHeight = height - padTop - padBottom;

  function yFor(price: number) {
    return padTop + plotHeight - ((price - min) / range) * plotHeight;
  }

  function pointsFor(pts: HistoryPoint[]) {
    return pts.map((p, i) => ({
      x: pts.length > 1 ? (i / (pts.length - 1)) * width : width / 2,
      y: yFor(p.price),
      price: p.price,
      date: p.recordedAt,
    }));
  }

  const gridLines = [min, (min + max) / 2, max];
  const firstDate = history.length > 0 ? history[0].recordedAt : null;
  const lastDate = history.length > 0 ? history[history.length - 1].recordedAt : null;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Price History</h3>
      <div className="flex gap-2">
        {/* Y-axis price labels */}
        <div
          className="flex shrink-0 flex-col justify-between text-right text-[10px] text-zinc-500"
          style={{ height, paddingTop: padTop, paddingBottom: padBottom }}
        >
          <span>${max.toFixed(2)}</span>
          {max !== min && <span>${((min + max) / 2).toFixed(2)}</span>}
          <span>${min.toFixed(2)}</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
          {/* horizontal gridlines */}
          {gridLines.map((g, i) => (
            <line
              key={i}
              x1={0}
              x2={width}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="#3f3f46"
              strokeWidth={1}
              strokeDasharray={i === gridLines.length - 1 || i === 0 ? undefined : "3 3"}
            />
          ))}

          {series.map(([source, pts]) => {
            const points = pointsFor(pts);
            return (
              <g key={source}>
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={CHART_COLOR[source] ?? "#a1a1aa"}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3} fill={CHART_COLOR[source] ?? "#a1a1aa"}>
                    <title>
                      {(SOURCE_LABEL[source] ?? source)} — ${p.price.toFixed(2)} ({fmtDate(p.date)})
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* x-axis date range */}
          {firstDate && (
            <text x={0} y={height - 4} fontSize={9} fill="#71717a">
              {fmtDate(firstDate)}
            </text>
          )}
          {lastDate && (
            <text x={width} y={height - 4} fontSize={9} fill="#71717a" textAnchor="end">
              {fmtDate(lastDate)}
            </text>
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
        {series.map(([source, pts]) => {
          const first = pts[0].price;
          const last = pts[pts.length - 1].price;
          const delta = last - first;
          const pct = first !== 0 ? (delta / first) * 100 : 0;
          const deltaColor = delta > 0 ? "text-red-400" : delta < 0 ? "text-green-400" : "text-zinc-500";
          return (
            <span key={source} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLOR[source] ?? "#a1a1aa" }} />
              <span className="font-medium text-zinc-300">{SOURCE_LABEL[source] ?? source}</span>
              <span>${last.toFixed(2)}</span>
              {delta !== 0 && (
                <span className={deltaColor}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
                </span>
              )}
            </span>
          );
        })}
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
    Common: "border-zinc-600 bg-zinc-700/40 text-zinc-300",
    Uncommon: "border-green-600 bg-green-900/40 text-green-300",
    Rare: "border-blue-500 bg-blue-900/40 text-blue-300",
    Epic: "border-purple-500 bg-purple-900/40 text-purple-300",
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="grid gap-10 sm:grid-cols-[300px_1fr]">
        {/* Card image — the source PNGs have a transparent margin baked in
            around the rounded card art, so a slight zoom crops that margin
            out instead of letting the container background show through it. */}
        <div className="relative overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: "3/4" }}>
          <Image
            src={selected.image}
            alt={selected.name}
            fill
            sizes="300px"
            style={{ transform: "scale(1.04)" }}
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
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium ${RARITY_COLOR[tag] ?? "border-zinc-700 bg-zinc-800/50 text-zinc-300"}`}
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
                              <span className="text-xs font-medium text-zinc-300">{SOURCE_LABEL[source] ?? source}</span>
                            )}
                          </div>
                        </td>
                        {VARIANT_COL_KEYS.map((col) => {
                          const mp = getPriceForCol(source, col);
                          return (
                            <td key={col} className="px-3 py-3 text-right">
                              {mp ? (
                                <div className="flex flex-col items-end gap-1">
                                  {source === "dyli" ? (
                                    <a
                                      href={DYLI_AFFILIATE}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-yellow-300 hover:underline"
                                    >
                                      ${mp.price.toFixed(2)}
                                    </a>
                                  ) : (
                                    <span className="font-medium text-zinc-100">${mp.price.toFixed(2)}</span>
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
