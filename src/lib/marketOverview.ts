import { prisma } from "@/lib/prisma";
import { getEffectiveCards } from "@/lib/catalog";

export interface PriceTier {
  label: string;
  count: number;
  totalValue: number;
  avgPrice: number;
}

export interface Mover {
  cardId: string;
  cardName: string;
  source: string;
  latestPrice: number;
  currency: string;
  pctChange: number;
  daysSpan: number;
}

export interface MarketOverview {
  totalMarketValue: number;
  tradingCards: number;
  priceTiers: PriceTier[];
  gainers: Mover[];
  decliners: Mover[];
  hasEnoughHistory: boolean;
}

const TIER_DEFS = [
  { label: "High-Value (≥$20)", min: 20, max: Infinity },
  { label: "Mid-Value ($5–$19.99)", min: 5, max: 20 },
  { label: "Low-Value (<$5)", min: 0, max: 5 },
];

export async function getMarketOverview(): Promise<MarketOverview> {
  const cards = await getEffectiveCards();
  const inStock = cards.filter((c) => c.stock > 0);

  const totalMarketValue = inStock.reduce((sum, c) => sum + c.price * c.stock, 0);

  const priceTiers: PriceTier[] = TIER_DEFS.map((tier) => {
    const inTier = inStock.filter((c) => c.price >= tier.min && c.price < tier.max);
    const totalValue = inTier.reduce((s, c) => s + c.price * c.stock, 0);
    return {
      label: tier.label,
      count: inTier.length,
      totalValue,
      avgPrice: inTier.length > 0 ? totalValue / inTier.reduce((s, c) => s + c.stock, 0) : 0,
    };
  });

  // Gainers/decliners: for every (cardId, source) pair with at least two
  // recorded price points, compare the earliest to the latest we have.
  const history = await prisma.marketPriceHistory.findMany({
    where: { source: { in: ["dyli", "minmax"] } },
    orderBy: { recordedAt: "asc" },
  });

  const bySourceCard = new Map<string, typeof history>();
  for (const row of history) {
    const key = `${row.cardId}::${row.source}`;
    const group = bySourceCard.get(key);
    if (group) group.push(row);
    else bySourceCard.set(key, [row]);
  }

  const cardNameById = new Map(cards.map((c) => [c.id, c.name]));
  const movers: Mover[] = [];

  for (const rows of bySourceCard.values()) {
    if (rows.length < 2) continue;
    const earliest = rows[0];
    const latest = rows[rows.length - 1];
    if (earliest.price <= 0 || earliest.id === latest.id) continue;

    const pctChange = ((latest.price - earliest.price) / earliest.price) * 100;
    const daysSpan = Math.max(
      1,
      Math.round((latest.recordedAt.getTime() - earliest.recordedAt.getTime()) / 86_400_000)
    );

    movers.push({
      cardId: latest.cardId,
      cardName: cardNameById.get(latest.cardId.split("::")[0]) ?? latest.cardId,
      source: latest.source,
      latestPrice: latest.price,
      currency: latest.currency,
      pctChange,
      daysSpan,
    });
  }

  const sorted = [...movers].sort((a, b) => b.pctChange - a.pctChange);
  const gainers = sorted.filter((m) => m.pctChange > 0).slice(0, 5);
  const decliners = sorted
    .filter((m) => m.pctChange < 0)
    .sort((a, b) => a.pctChange - b.pctChange)
    .slice(0, 5);

  return {
    totalMarketValue,
    tradingCards: inStock.length,
    priceTiers,
    gainers,
    decliners,
    hasEnoughHistory: movers.length > 0,
  };
}
