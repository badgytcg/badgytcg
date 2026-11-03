import { prisma } from "@/lib/prisma";

const COMPLETED = ["paid", "fulfilled", "delivered"];

export interface RecentSale {
  priceCents: number;
  variant: string; // base | foil | arctic | birb | pengu | special
  qty: number;
  soldAt: string;
}

function variantOf(cardId: string): string {
  if (cardId.startsWith("special::")) return "special";
  const m = cardId.match(/::(foil|arctic|birb|pengu)$/);
  return m ? m[1] : "base";
}

// Match a base card id and any of its variant ids ("base::foil", etc.).
function idFilter(baseCardId: string) {
  return { OR: [{ cardId: baseCardId }, { cardId: { startsWith: `${baseCardId}::` } }] };
}

/** The last N sales of this card (any variant) from our own completed orders.
 * Buyer-free by construction — only price, variant, qty, date. */
export async function recentSales(baseCardId: string, limit = 10): Promise<RecentSale[]> {
  const rows = await prisma.orderItem.findMany({
    where: { ...idFilter(baseCardId), order: { status: { in: COMPLETED } } },
    include: { order: { select: { createdAt: true } } },
    orderBy: { order: { createdAt: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    priceCents: r.priceCents,
    variant: variantOf(r.cardId),
    qty: r.qty,
    soldAt: r.order.createdAt.toISOString(),
  }));
}

export interface SalesStats {
  lastSold: { priceCents: number; soldAt: string } | null;
  unitsSold: number; // total units sold, all time
  ordersCount: number;
}

/** Light sales stats for the card page. Only facts from our orders. */
export async function salesStats(baseCardId: string): Promise<SalesStats> {
  const rows = await prisma.orderItem.findMany({
    where: { ...idFilter(baseCardId), order: { status: { in: COMPLETED } } },
    include: { order: { select: { createdAt: true } } },
    orderBy: { order: { createdAt: "desc" } },
  });
  const unitsSold = rows.reduce((n, r) => n + r.qty, 0);
  const last = rows[0];
  return {
    lastSold: last ? { priceCents: last.priceCents, soldAt: last.order.createdAt.toISOString() } : null,
    unitsSold,
    ordersCount: rows.length,
  };
}
