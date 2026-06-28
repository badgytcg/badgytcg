"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Mover {
  cardId: string;
  cardName: string;
  source: string;
  latestPrice: number;
  currency: string;
  pctChange: number;
  daysSpan: number;
}

interface PriceTier {
  label: string;
  count: number;
  totalValue: number;
  avgPrice: number;
}

interface Overview {
  totalMarketValue: number;
  tradingCards: number;
  priceTiers: PriceTier[];
  gainers: Mover[];
  decliners: Mover[];
  hasEnoughHistory: boolean;
}

const SOURCE_LABEL: Record<string, string> = { dyli: "Dyli", minmax: "MinMax", site: "BadgyTCG" };

function baseCardId(id: string): string {
  return id.split("::")[0];
}

function MoverRow({ mover }: { mover: Mover }) {
  const up = mover.pctChange > 0;
  return (
    <li className="flex items-center justify-between py-2">
      <div>
        <Link href={`/vibes/cards/${baseCardId(mover.cardId)}`} className="text-sm font-medium text-zinc-100 hover:text-purple-300">
          {mover.cardName}
        </Link>
        <p className="text-xs text-zinc-500">{SOURCE_LABEL[mover.source] ?? mover.source} · over {mover.daysSpan}d</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-zinc-200">${mover.latestPrice.toFixed(2)}</p>
        <p className={`text-xs font-medium ${up ? "text-green-400" : "text-red-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(mover.pctChange).toFixed(1)}%
        </p>
      </div>
    </li>
  );
}

export default function MarketOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/market-overview")
      .then((res) => res.json())
      .then(setOverview);
  }, []);

  if (!overview) {
    return <div className="mx-auto max-w-6xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Market Prices</h1>
      <p className="mb-8 text-sm text-zinc-400">
        Live value of what&apos;s in stock on BadgyTCG, plus price trends pulled from Dyli and MinMax Games.
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Total Market Value</p>
          <p className="mt-1 text-2xl font-bold text-green-400">${overview.totalMarketValue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-zinc-500">Across {overview.tradingCards} card(s) in stock</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Trading Cards</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">{overview.tradingCards}</p>
          <p className="mt-1 text-xs text-zinc-500">Currently in stock</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Price Movers Tracked</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">{overview.gainers.length + overview.decliners.length}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {overview.hasEnoughHistory ? "From accumulated price history" : "Building up — check back after a few refreshes"}
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Price Tiers</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {overview.priceTiers.map((tier) => (
          <div key={tier.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-semibold text-zinc-100">{tier.label}</p>
            <p className="mt-1 text-xs text-zinc-500">{tier.count} card(s)</p>
            <p className="mt-2 text-lg font-bold text-purple-300">${tier.totalValue.toFixed(2)}</p>
            <p className="text-xs text-zinc-500">avg ${tier.avgPrice.toFixed(2)}/card</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-green-400">Top Gainers</h2>
          {overview.gainers.length === 0 ? (
            <p className="py-2 text-sm text-zinc-500">No upward movers yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {overview.gainers.map((m) => (
                <MoverRow key={`${m.cardId}::${m.source}`} mover={m} />
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-400">Top Decliners</h2>
          {overview.decliners.length === 0 ? (
            <p className="py-2 text-sm text-zinc-500">No downward movers yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {overview.decliners.map((m) => (
                <MoverRow key={`${m.cardId}::${m.source}`} mover={m} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {!overview.hasEnoughHistory && (
        <p className="mt-8 text-center text-xs text-zinc-500">
          Gainers/decliners need at least two &quot;Refresh Market Prices&quot; runs (in admin) spaced apart to
          show a real trend — they&apos;ll fill in as that history builds up.
        </p>
      )}
    </div>
  );
}
