"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useStore } from "@/context/StoreContext";
import { parseDeckCode } from "@/lib/deckParser";
import { findCardByAnyName, matchDeckToInventory } from "@/lib/inventory";
import { colorCategory } from "@/lib/colors";
import { Card, DeckImportResult, ParsedDeck } from "@/lib/types";

const PLACEHOLDER = `// Purple at the Disco
4 Get Rekt
1 Lil Waker
2 Mount Fuji
2 Prized Birb
3 Iron Penguin
...`;

// What you charge for a full pre-built deck, regardless of singles pricing.
const DECK_BUNDLE_PRICE = 35;

const COLOR_HEX: Record<string, string> = {
  Yellow: "#facc15",
  Purple: "#a855f7",
  Blue: "#3b82f6",
  Green: "#22c55e",
  Red: "#ef4444",
  "Multi-color": "#ec4899",
  Colorless: "#a1a1aa",
};

const TYPE_HEX: Record<string, string> = {
  Character: "#3b82f6",
  Action: "#a855f7",
  Relic: "#f59e0b",
  Rod: "#06b6d4",
};
const FALLBACK_HEX = ["#f59e0b", "#06b6d4", "#ef4444", "#22c55e", "#eab308", "#a1a1aa"];

function conicGradient(slices: { value: number; color: string }[]): string {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return "#27272a"; // zinc-800, empty state
  let acc = 0;
  const stops = slices.map(({ value, color }) => {
    const start = (acc / total) * 360;
    acc += value;
    const end = (acc / total) * 360;
    return `${color} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function PieStat({ title, slices }: { title: string; slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{title}</p>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 rounded-full" style={{ background: conicGradient(slices) }} />
        <ul className="space-y-0.5 text-xs text-zinc-300">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label} {total > 0 ? s.value : 0}
            </li>
          ))}
          {slices.length === 0 && <li className="text-zinc-600">—</li>}
        </ul>
      </div>
    </div>
  );
}

function FishCurve({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Fish Curve</p>
      <div className="flex h-16 items-end gap-1">
        {counts.map((c, cost) => (
          <div key={cost} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-purple-500"
              style={{ height: c > 0 ? `${Math.max((c / max) * 100, 6)}%` : "2px" }}
              title={`Cost ${cost}: ${c}`}
            />
            <span className="text-[9px] text-zinc-600">{cost === counts.length - 1 ? `${cost}+` : cost}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeckImportPage() {
  const { addManyToCart, addToWishlist } = useStore();
  const [code, setCode] = useState("");
  const [rawDeck, setRawDeck] = useState<ParsedDeck | null>(null);
  const [result, setResult] = useState<DeckImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [catalog, setCatalog] = useState<Card[] | undefined>(undefined);
  const [importExpanded, setImportExpanded] = useState(true);

  // Fetch the live (admin-editable) catalog once so deck matching reflects
  // current stock rather than whatever was true at build time.
  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => setCatalog(data.cards));
  }, []);

  function handleParse() {
    setError(null);
    setResult(null);
    setRawDeck(null);
    setConfirmed(false);
    setRequested(false);
    try {
      const deck = parseDeckCode(code);
      const matched = matchDeckToInventory(deck, DECK_BUNDLE_PRICE, catalog);
      setRawDeck(deck);
      setResult(matched);
      setImportExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't parse that deck code.");
    }
  }

  function handleConfirm() {
    if (!result) return;
    addManyToCart(
      result.available.map((a) => ({ cardId: a.card.id, qty: a.qty }))
    );
    if (result.missing.length > 0) {
      addToWishlist(result.missing);
    }
    setConfirmed(true);
  }

  // Alternative to buying what's in stock now: queue the entire deck as a
  // single sourcing request, regardless of what's already available.
  function handleRequestWholeDeck() {
    if (!rawDeck) return;
    addToWishlist(
      rawDeck.entries.map((entry) => ({
        cardName: entry.name,
        cardId: findCardByAnyName(entry.name, catalog)?.id ?? null,
        qty: entry.qty,
        note: `Deck request: ${rawDeck.deckName}`,
      }))
    );
    setRequested(true);
  }

  const stats = useMemo(() => {
    if (!result) return null;
    const resolved = result.entries.filter((e): e is { card: Card; cardName: string; qty: number } => e.card !== null);

    const COST_BUCKETS = 13; // 0..11, 12+
    const costCounts = new Array(COST_BUCKETS).fill(0);
    const typeCounts = new Map<string, number>();
    const colorCounts = new Map<string, number>();
    let inStockCost = 0;
    let totalKnownCost = 0;
    let unpricedCount = 0;

    for (const e of resolved) {
      const cost = Math.min(e.card.cost ?? 0, COST_BUCKETS - 1);
      costCounts[cost] += e.qty;
      typeCounts.set(e.card.type, (typeCounts.get(e.card.type) ?? 0) + e.qty);
      const cat = colorCategory(e.card);
      colorCounts.set(cat, (colorCounts.get(cat) ?? 0) + e.qty);
      totalKnownCost += e.card.price * e.qty;
    }
    for (const e of result.entries) {
      if (!e.card) unpricedCount += e.qty;
    }
    for (const a of result.available) {
      inStockCost += a.card.price * a.qty;
    }

    const typeSlices = Array.from(typeCounts.entries()).map(([label, value], i) => ({
      label,
      value,
      color: TYPE_HEX[label] ?? FALLBACK_HEX[i % FALLBACK_HEX.length],
    }));
    const colorSlices = Array.from(colorCounts.entries()).map(([label, value], i) => ({
      label,
      value,
      color: COLOR_HEX[label] ?? FALLBACK_HEX[i % FALLBACK_HEX.length],
    }));

    return { costCounts, typeSlices, colorSlices, inStockCost, totalKnownCost, unpricedCount };
  }, [result]);

  const totalRequested = result
    ? result.available.reduce((s, a) => s + a.qty, 0) + result.missing.reduce((s, m) => s + m.qty, 0)
    : 0;
  const haveCount = result ? result.available.reduce((s, a) => s + a.qty, 0) : 0;
  const isComplete = result ? result.missing.length === 0 : false;
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Import a Deck Code</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Paste a deck list in either format — the plain text export or the JSON{" "}
        <code className="rounded bg-zinc-800 px-1">{"{ deckName, counts }"}</code> format.
        Then either buy what&apos;s in stock now (missing cards go to your
        wishlist automatically), or skip straight to requesting the whole
        deck as a Deck Request if you&apos;d rather wait until it&apos;s
        fully sourced.
      </p>

      {(importExpanded || !result) && (
        <>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={12}
            className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleParse}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              Check Deck
            </button>
            {result && (
              <button
                onClick={() => setImportExpanded(false)}
                className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {result && stats && !importExpanded && (
        <button
          onClick={() => setImportExpanded(true)}
          className="mt-6 text-sm text-purple-400 hover:underline"
        >
          ← Check or import a different deck
        </button>
      )}

      {result && stats && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{result.deckName}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {haveCount} / {totalRequested} cards in stock.{" "}
                {isComplete ? (
                  <span className="text-green-400">Full deck available!</span>
                ) : (
                  <span className="text-yellow-400">{result.missing.length} card type(s) need sourcing.</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-8">
              <div className="w-40">
                <FishCurve counts={stats.costCounts} />
              </div>
              <PieStat title="By Type" slices={stats.typeSlices} />
              <PieStat title="By Color" slices={stats.colorSlices} />
            </div>
          </div>

          {/* Card art grid */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {result.entries.map((e, i) => {
              const haveQty = e.card
                ? result.available.find((a) => a.card.id === e.card!.id)?.qty ?? 0
                : 0;
              const short = e.qty - haveQty;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
                    style={{ aspectRatio: "3/4" }}
                  >
                    {e.card ? (
                      <Image
                        src={e.card.image}
                        alt={e.card.name}
                        fill
                        sizes="160px"
                        style={{ transform: "scale(1.04)" }}
                        className={`object-cover ${haveQty === 0 ? "grayscale opacity-40" : ""}`}
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-zinc-600">
                        No image
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-1 w-full text-center text-[11px] text-zinc-300" title={e.cardName}>
                    {e.cardName}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400">
                    ×{e.qty}
                    {short > 0 && short < e.qty && (
                      <span className="ml-1 text-yellow-500">({haveQty} in stock)</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-green-400">In stock → cart</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.available.map((a) => (
                  <li key={a.card.id}>{a.qty}x {a.card.name}</li>
                ))}
                {result.available.length === 0 && <li className="text-zinc-500">None</li>}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-yellow-400">Missing → wishlist</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.missing.map((m, i) => (
                  <li key={i}>{m.qty}x {m.cardName}</li>
                ))}
                {result.missing.length === 0 && <li className="text-zinc-500">None</li>}
              </ul>
            </div>
          </div>

          <div className="mt-4 space-y-1 text-sm text-zinc-400">
            <p>
              Cost of what&apos;s in stock:{" "}
              <span className="font-semibold text-green-400">${stats.inStockCost.toFixed(2)}</span>
            </p>
            <p>
              Full deck total at current prices:{" "}
              <span className="font-semibold text-purple-300">${stats.totalKnownCost.toFixed(2)}</span>
              {stats.unpricedCount > 0 && (
                <span className="text-zinc-500"> ({stats.unpricedCount} card(s) not in catalog — excluded)</span>
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirmed}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
            >
              {confirmed ? "Added!" : "Buy what's in stock"}
            </button>
            <button
              onClick={handleRequestWholeDeck}
              disabled={requested}
              className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300 disabled:opacity-40"
            >
              {requested ? "Requested!" : "♡ Request entire deck instead"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            &quot;Buy what&apos;s in stock&quot; splits the deck between your cart and wishlist.
            &quot;Request entire deck&quot; skips the cart and puts every card — including
            what&apos;s already in stock — on your wishlist as one Deck Request, for when you&apos;d
            rather wait and buy it all at once.
          </p>
        </div>
      )}
    </div>
  );
}
