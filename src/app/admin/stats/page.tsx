"use client";

import { useEffect, useState } from "react";

interface AdminStats {
  totalInventoryValue: number;
  totalUnits: number;
  outOfStockCount: number;
  totalCatalog: number;
  cardsAvailable: number;
  priceTiers: Array<{ label: string; count: number; totalValue: number; avgPrice: number }>;
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return <div className="mx-auto max-w-4xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  const stockPct = stats.totalCatalog > 0
    ? Math.round((stats.cardsAvailable / stats.totalCatalog) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-100">Inventory Stats</h1>
      <p className="mb-8 text-sm text-zinc-400">Live snapshot of your current inventory.</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="Total Inventory Value"
          value={`$${stats.totalInventoryValue.toFixed(2)}`}
          sub="price × stock, all cards"
          accent="text-green-400"
        />
        <StatBox
          label="Total Units in Stock"
          value={stats.totalUnits.toLocaleString()}
          sub="individual cards on hand"
        />
        <StatBox
          label="Unique Cards Available"
          value={`${stats.cardsAvailable} / ${stats.totalCatalog}`}
          sub={`${stockPct}% of catalog in stock`}
        />
        <StatBox
          label="Out of Stock"
          value={stats.outOfStockCount.toLocaleString()}
          sub="cards with 0 inventory"
          accent="text-red-400"
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Value by Price Tier</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.priceTiers.map((tier) => (
          <div key={tier.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-semibold text-zinc-100">{tier.label}</p>
            <p className="mt-1 text-xs text-zinc-500">{tier.count} unique card(s)</p>
            <p className="mt-2 text-xl font-bold text-purple-300">${tier.totalValue.toFixed(2)}</p>
            <p className="text-xs text-zinc-500">avg ${tier.avgPrice.toFixed(2)} / unit</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  accent = "text-zinc-100",
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}
