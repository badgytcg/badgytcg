import { prisma } from "@/lib/prisma";
import { getEffectiveCards } from "@/lib/catalog";
import { cards as allSeedCards } from "@/data/cards";

export interface Mover {
  cardId: string;
  cardName: string;
  source: string;
  latestPrice: number;
  currency: string;
  pctChange: number;
  daysSpan: number;
}

export interface Deal {
  cardId: string;
  cardName: string;
  ourPrice: number;
  marketPrice: number;
  source: string;
  savingsPct: number;
}

export interface SimpleCard {
  cardId: string;
  cardName: string;
  price: number;
  stock: number;
  rarity: string;
}

export interface MarketOverview {
  // catalog coverage
  cardsAvailable: number;
  totalCatalog: number;
  // movers
  gainers: Mover[];
  decliners: Mover[];
  hasEnoughHistory: boolean;
  // curated lists
  bestDeals: Deal[];
  mostExpensive: SimpleCard[];
  budgetPicks: SimpleCard[];
}

// Admin-only stats kept separate from the public overview
export interface AdminStats {
  totalInventoryValue: number;
  totalUnits: number;
  outOfStockCount: number;
  totalCatalog: number;
  cardsAvailable: number;
  priceTiers: Array<{ label: string; count: number; totalValue: number; avgPrice: number }>;
}

const TIER_DEFS = [
  { label: "High-Value (≥$20)", min: 20, max: Infinity },
  { label: "Mid-Value ($5–$19.99)", min: 5, max: 20 },
  { label: "Low-Value (<$5)", min: 0, max: 5 },
];

export async function getMarketOverview(): Promise<MarketOverview> {
  const cards = await getEffectiveCards();
  const inStock = cards.filter((c) => c.stock > 0 && !c.id.startsWith("special::"));
  const totalCatalog = allSeedCards.length;

  // Latest market price per (cardId, source)
  const history = await prisma.marketPriceHistory.findMany({
    where: { source: { in: ["dyli", "minmax"] } },
    orderBy: { recordedAt: "asc" },
  });

  // Gainers / decliners
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

  // Latest price per (cardId, source) for deals calculation
  const latestByKey = new Map<string, number>();
  for (const rows of bySourceCard.values()) {
    if (rows.length === 0) continue;
    const latest = rows[rows.length - 1];
    latestByKey.set(`${latest.cardId}::${latest.source}`, latest.price);
  }

  // Best deals: our price is meaningfully below the lowest external market price
  const deals: Deal[] = [];
  for (const card of inStock) {
    if (card.price <= 0) continue;
    const dyliPrice = latestByKey.get(`${card.id}::dyli`);
    const minmaxPrice = latestByKey.get(`${card.id}::minmax`);
    const candidates = [dyliPrice, minmaxPrice].filter((p): p is number => p != null && p > 0);
    if (candidates.length === 0) continue;
    const lowestMarket = Math.min(...candidates);
    const savingsPct = ((lowestMarket - card.price) / lowestMarket) * 100;
    if (savingsPct >= 5) {
      const bestSource = dyliPrice === lowestMarket ? "dyli" : "minmax";
      deals.push({
        cardId: card.id,
        cardName: card.name,
        ourPrice: card.price,
        marketPrice: lowestMarket,
        source: bestSource,
        savingsPct,
      });
    }
  }
  const bestDeals = deals.sort((a, b) => b.savingsPct - a.savingsPct).slice(0, 5);

  // Most expensive in stock
  const mostExpensive: SimpleCard[] = [...inStock]
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)
    .map((c) => ({ cardId: c.id, cardName: c.name, price: c.price, stock: c.stock, rarity: c.rarity }));

  // Budget picks: cheapest with stock, price > 0
  const budgetPicks: SimpleCard[] = [...inStock]
    .filter((c) => c.price > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 5)
    .map((c) => ({ cardId: c.id, cardName: c.name, price: c.price, stock: c.stock, rarity: c.rarity }));

  return {
    cardsAvailable: inStock.length,
    totalCatalog,
    gainers,
    decliners,
    hasEnoughHistory: movers.length > 0,
    bestDeals,
    mostExpensive,
    budgetPicks,
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  const cards = await getEffectiveCards();
  const regularCards = cards.filter((c) => !c.id.startsWith("special::"));
  const inStock = regularCards.filter((c) => c.stock > 0);
  const outOfStockCount = regularCards.filter((c) => c.stock === 0).length;

  const totalInventoryValue = inStock.reduce((sum, c) => sum + c.price * c.stock, 0);
  const totalUnits = inStock.reduce((sum, c) => sum + c.stock, 0);

  const priceTiers = TIER_DEFS.map((tier) => {
    const inTier = inStock.filter((c) => c.price >= tier.min && c.price < tier.max);
    const totalValue = inTier.reduce((s, c) => s + c.price * c.stock, 0);
    const totalUnitsInTier = inTier.reduce((s, c) => s + c.stock, 0);
    return {
      label: tier.label,
      count: inTier.length,
      totalValue,
      avgPrice: totalUnitsInTier > 0 ? totalValue / totalUnitsInTier : 0,
    };
  });

  return {
    totalInventoryValue,
    totalUnits,
    outOfStockCount,
    totalCatalog: allSeedCards.length,
    cardsAvailable: inStock.length,
    priceTiers,
  };
}
