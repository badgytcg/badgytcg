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

interface Deal {
  cardId: string;
  cardName: string;
  ourPrice: number;
  marketPrice: number;
  source: string;
  savingsPct: number;
}

interface SimpleCard {
  cardId: string;
  cardName: string;
  price: number;
  stock: number;
  rarity: string;
}

interface Overview {
  cardsAvailable: number;
  totalCatalog: number;
  gainers: Mover[];
  decliners: Mover[];
  hasEnoughHistory: boolean;
  bestDeals: Deal[];
  mostExpensive: SimpleCard[];
  budgetPicks: SimpleCard[];
}

const SOURCE_LABEL: Record<string, string> = { dyli: "Dyli", scg: "StarCityGames", site: "BadgyTCG" };
const RARITY_COLOR: Record<string, string> = {
  Common: "text-zinc-400",
  Uncommon: "text-blue-400",
  Rare: "text-purple-400",
  Epic: "text-yellow-400",
};

function baseCardId(id: string): string {
  return id.split("::")[0];
}

function MoverRow({ mover }: { mover: Mover }) {
  const up = mover.pctChange > 0;
  return (
    <li className="flex items-center justify-between py-2.5">
      <div className="min-w-0 pr-3">
        <Link
          href={`/vibes/cards/${baseCardId(mover.cardId)}`}
          className="truncate text-sm font-medium text-zinc-100 hover:text-purple-300"
        >
          {mover.cardName}
        </Link>
        <p className="text-xs text-zinc-500">{SOURCE_LABEL[mover.source] ?? mover.source} · over {mover.daysSpan}d</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm text-zinc-200">${mover.latestPrice.toFixed(2)}</p>
        <p className={`text-xs font-semibold ${up ? "text-green-400" : "text-red-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(mover.pctChange).toFixed(1)}%
        </p>
      </div>
    </li>
  );
}

function CardRow({ card }: { card: SimpleCard }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <div className="min-w-0 pr-3">
        <Link
          href={`/vibes/cards/${baseCardId(card.cardId)}`}
          className="truncate text-sm font-medium text-zinc-100 hover:text-purple-300"
        >
          {card.cardName}
        </Link>
        <p className={`text-xs ${RARITY_COLOR[card.rarity] ?? "text-zinc-500"}`}>{card.rarity}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-zinc-100">${card.price.toFixed(2)}</p>
        <p className="text-xs text-zinc-500">{card.stock} in stock</p>
      </div>
    </li>
  );
}

function DealRow({ deal }: { deal: Deal }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <div className="min-w-0 pr-3">
        <Link
          href={`/vibes/cards/${baseCardId(deal.cardId)}`}
          className="truncate text-sm font-medium text-zinc-100 hover:text-purple-300"
        >
          {deal.cardName}
        </Link>
        <p className="text-xs text-zinc-500">
          vs {SOURCE_LABEL[deal.source] ?? deal.source} ${deal.marketPrice.toFixed(2)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-green-300">${deal.ourPrice.toFixed(2)}</p>
        <p className="text-xs font-medium text-green-500">{deal.savingsPct.toFixed(0)}% below market</p>
      </div>
    </li>
  );
}

function Panel({
  title,
  titleColor = "text-zinc-400",
  empty,
  children,
}: {
  title: string;
  titleColor?: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className={`mb-1 text-sm font-semibold uppercase tracking-wide ${titleColor}`}>{title}</h2>
      {empty ? (
        <p className="py-2 text-sm text-zinc-500">Nothing to show yet — check back soon.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">{children}</ul>
      )}
    </div>
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
    return <div className="mx-auto max-w-6xl px-6 py-16 text-center text-zinc-500">Loading market data...</div>;
  }

  const stockPct =
    overview.totalCatalog > 0
      ? Math.round((overview.cardsAvailable / overview.totalCatalog) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Market</h1>
      <p className="mb-8 text-sm text-zinc-400">
        What&apos;s in stock, where to find the best deals, and how prices are moving across the market.
      </p>

      {/* Summary stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Cards Available</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {overview.cardsAvailable}{" "}
            <span className="text-base font-normal text-zinc-500">/ {overview.totalCatalog}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{stockPct}% of the full catalog in stock</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Best Deal Right Now</p>
          {overview.bestDeals[0] ? (
            <>
              <p className="mt-1 text-lg font-bold text-green-300">
                {overview.bestDeals[0].cardName}
              </p>
              <p className="mt-0.5 text-xs text-green-500">
                {overview.bestDeals[0].savingsPct.toFixed(0)}% below {SOURCE_LABEL[overview.bestDeals[0].source]} market price
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">Deals update with market price refreshes.</p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Price Movers Tracked</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {overview.gainers.length + overview.decliners.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {overview.hasEnoughHistory
              ? "From accumulated Dyli & StarCityGames history"
              : "Building up — check back after a few price refreshes"}
          </p>
        </div>
      </div>

      {/* Four content panels */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <Panel title="Best Deals" titleColor="text-green-400" empty={overview.bestDeals.length === 0}>
          {overview.bestDeals.map((d) => (
            <DealRow key={d.cardId} deal={d} />
          ))}
        </Panel>

        <Panel title="Highest Value in Stock" titleColor="text-yellow-400" empty={overview.mostExpensive.length === 0}>
          {overview.mostExpensive.map((c) => (
            <CardRow key={c.cardId} card={c} />
          ))}
        </Panel>

        <Panel title="Budget Picks" titleColor="text-blue-400" empty={overview.budgetPicks.length === 0}>
          {overview.budgetPicks.map((c) => (
            <CardRow key={c.cardId} card={c} />
          ))}
        </Panel>

        <div className="grid gap-6">
          <Panel title="Top Gainers" titleColor="text-green-400" empty={overview.gainers.length === 0}>
            {overview.gainers.map((m) => (
              <MoverRow key={`${m.cardId}::${m.source}`} mover={m} />
            ))}
          </Panel>
          <Panel title="Top Decliners" titleColor="text-red-400" empty={overview.decliners.length === 0}>
            {overview.decliners.map((m) => (
              <MoverRow key={`${m.cardId}::${m.source}`} mover={m} />
            ))}
          </Panel>
        </div>
      </div>

      {!overview.hasEnoughHistory && (
        <p className="text-center text-xs text-zinc-500">
          Gainers &amp; decliners need at least two market price refreshes to show real trends.
        </p>
      )}
    </div>
  );
}
