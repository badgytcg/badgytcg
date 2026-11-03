import { prisma } from "@/lib/prisma";

// Price history must span at least this many days before we show any chart,
// change %, or low/high/median. Until then the card page shows a clean
// "Tracking since <date>" state so we never present invented numbers.
export const MIN_HISTORY_DAYS = 7;

export interface SeriesPoint { t: string; priceCents: number }

export interface MarketSummary {
  variant: string;
  ready: boolean;            // ≥ MIN_HISTORY_DAYS of history
  trackingSince: string | null;
  daysTracked: number;
  // Everything below is null until `ready` — never guessed.
  change7dPct: number | null;
  change30dPct: number | null;
  low30Cents: number | null;
  high30Cents: number | null;
  median90Cents: number | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// Price nearest to (now - days), for change math.
function priceAround(points: { capturedAt: Date; priceCents: number }[], days: number): number | null {
  if (points.length === 0) return null;
  const target = Date.now() - days * 86_400_000;
  let best = points[0], bestDiff = Infinity;
  for (const p of points) {
    const diff = Math.abs(p.capturedAt.getTime() - target);
    if (diff < bestDiff) { best = p; bestDiff = diff; }
  }
  // Only count it if we actually have a point near that far back.
  return bestDiff <= 2 * 86_400_000 ? best.priceCents : null;
}

/** Chart series for a card/variant over the last `days` (All = 0). Empty array
 * when there's no history yet. */
export async function priceSeries(cardId: string, variant = "base", days = 0): Promise<SeriesPoint[]> {
  const where = { cardId, variant, ...(days > 0 ? { capturedAt: { gte: new Date(Date.now() - days * 86_400_000) } } : {}) };
  const rows = await prisma.priceSnapshot.findMany({ where, orderBy: { capturedAt: "asc" }, select: { capturedAt: true, priceCents: true } });
  return rows.map((r) => ({ t: r.capturedAt.toISOString(), priceCents: r.priceCents }));
}

/** Market summary for the card page. Gated on MIN_HISTORY_DAYS of snapshots. */
export async function marketSummary(cardId: string, variant = "base"): Promise<MarketSummary> {
  const rows = await prisma.priceSnapshot.findMany({
    where: { cardId, variant },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, priceCents: true },
  });

  if (rows.length === 0) {
    return { variant, ready: false, trackingSince: null, daysTracked: 0, change7dPct: null, change30dPct: null, low30Cents: null, high30Cents: null, median90Cents: null };
  }

  const first = rows[0].capturedAt;
  const daysTracked = daysBetween(first, new Date());
  const ready = daysTracked >= MIN_HISTORY_DAYS;
  const base = { variant, trackingSince: first.toISOString(), daysTracked };

  if (!ready) {
    return { ...base, ready: false, change7dPct: null, change30dPct: null, low30Cents: null, high30Cents: null, median90Cents: null };
  }

  const current = rows[rows.length - 1].priceCents;
  const p7 = priceAround(rows, 7);
  const p30 = priceAround(rows, 30);
  const cutoff30 = Date.now() - 30 * 86_400_000;
  const last30 = rows.filter((r) => r.capturedAt.getTime() >= cutoff30).map((r) => r.priceCents);
  const cutoff90 = Date.now() - 90 * 86_400_000;
  const last90 = rows.filter((r) => r.capturedAt.getTime() >= cutoff90).map((r) => r.priceCents);

  return {
    ...base,
    ready: true,
    change7dPct: p7 ? Math.round(((current - p7) / p7) * 1000) / 10 : null,
    change30dPct: p30 ? Math.round(((current - p30) / p30) * 1000) / 10 : null,
    low30Cents: last30.length ? Math.min(...last30) : null,
    high30Cents: last30.length ? Math.max(...last30) : null,
    median90Cents: median(last90),
  };
}
