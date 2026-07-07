"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OutOfStockCard {
  id: string;
  name: string;
  set: string;
  rarity: string;
  price: number;
}

interface AdminStats {
  totalInventoryValue: number;
  totalUnits: number;
  outOfStockCount: number;
  totalCatalog: number;
  cardsAvailable: number;
  priceTiers: Array<{ label: string; count: number; totalValue: number; avgPrice: number }>;
  outOfStock: OutOfStockCard[];
}

const RARITY_COLOR: Record<string, string> = {
  Common: "text-zinc-400",
  Uncommon: "text-blue-400",
  Rare: "text-purple-400",
  Epic: "text-yellow-400",
};

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [oosQuery, setOosQuery] = useState("");

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

  const filteredOos = oosQuery.trim()
    ? stats.outOfStock.filter(
        (c) =>
          c.name.toLowerCase().includes(oosQuery.toLowerCase()) ||
          c.set.toLowerCase().includes(oosQuery.toLowerCase())
      )
    : stats.outOfStock;

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
        {/* Clickable out-of-stock box */}
        <button
          onClick={() => setShowOutOfStock((v) => !v)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-left hover:border-red-700 transition-colors"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500">Out of Stock</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{stats.outOfStockCount.toLocaleString()}</p>
          <p className="mt-1 text-xs text-zinc-500">
            cards with 0 inventory
            <span className="ml-1 text-zinc-600">— click to {showOutOfStock ? "hide" : "see list"}</span>
          </p>
        </button>
      </div>

      {/* Out-of-stock drill-down */}
      {showOutOfStock && (
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400">
              Out of Stock — {stats.outOfStockCount} card{stats.outOfStockCount !== 1 ? "s" : ""}
            </h2>
            <input
              value={oosQuery}
              onChange={(e) => setOosQuery(e.target.value)}
              placeholder="Filter by name or set…"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 w-56"
            />
          </div>
          {filteredOos.length === 0 ? (
            <p className="text-sm text-zinc-500">No matches.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Set</th>
                    <th className="pb-2 pr-4">Rarity</th>
                    <th className="pb-2 pr-4">Listed Price</th>
                    <th className="pb-2">Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredOos.map((card) => (
                    <tr key={card.id}>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/inventory`}
                          className="text-zinc-100 hover:text-purple-300"
                        >
                          {card.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-zinc-500">{card.set}</td>
                      <td className={`py-2 pr-4 text-xs ${RARITY_COLOR[card.rarity] ?? "text-zinc-400"}`}>
                        {card.rarity}
                      </td>
                      <td className="py-2 pr-4 text-zinc-300">${card.price.toFixed(2)}</td>
                      <td className="py-2">
                        <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs text-red-400">
                          0 in stock
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOos.length < stats.outOfStockCount && (
                <p className="mt-2 text-xs text-zinc-500">
                  Showing {filteredOos.length} of {stats.outOfStockCount} — refine your search to narrow further.
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
