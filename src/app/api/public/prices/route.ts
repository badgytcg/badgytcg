import { NextResponse } from "next/server";
import { getEffectiveCards } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { isRateLimited, clientKeyFor } from "@/lib/rateLimit";

// ---------------------------------------------------------------------------
// Public read-only pricing feed — safe to call from another website.
//
//   GET /api/public/prices
//     ?q=<name search>      substring match on card name (case-insensitive)
//     ?set=<set name>       filter by set
//     ?inStockOnly=true     only cards with stock > 0
//     ?limit=<n>            cap results (default 1000, max 5000)
//
// CORS is open (Access-Control-Allow-Origin: *) so a partner site can fetch
// it directly from the browser. Every card includes a `url` deep-linking to
// its page on badgytcg.com, so you can send shoppers straight there.
//
// Response:
//   {
//     "source": "badgytcg.com",
//     "updatedAt": "2026-09-09T...Z",
//     "count": 123,
//     "cards": [
//       {
//         "name": "Contemplation Penguin",
//         "set": "Enter the Huddle",
//         "rarity": "Common",
//         "price": 0.50,           // our store price, USD
//         "inStock": true,
//         "stock": 7,
//         "image": "https://...",
//         "url": "https://badgytcg.com/vibes/cards/eth-contemplationpenguin",
//         "market": { "dyli": 0.45, "scg": 0.59 }   // comparison prices, if any
//       }
//     ]
//   }
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  // Light rate limit so the public feed can't be hammered.
  if (isRateLimited(clientKeyFor(request, "public-prices"), 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429, headers: CORS });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const setFilter = (searchParams.get("set") ?? "").trim().toLowerCase();
  const inStockOnly = searchParams.get("inStockOnly") === "true";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 1000, 1), 5000);

  // Absolute base URL for deep links — prefer the real host, fall back to prod.
  const host = request.headers.get("host");
  const base = host ? `https://${host}` : "https://badgytcg.com";

  const all = await getEffectiveCards();

  // Latest market comparison price per card+source (dyli/scg).
  const marketRows = await prisma.marketPrice.findMany({ select: { cardId: true, source: true, price: true } });
  const marketByCard = new Map<string, Record<string, number>>();
  for (const r of marketRows) {
    if (!marketByCard.has(r.cardId)) marketByCard.set(r.cardId, {});
    marketByCard.get(r.cardId)![r.source] = r.price;
  }

  const filtered = all.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (setFilter && c.set.toLowerCase() !== setFilter) return false;
    if (inStockOnly && c.stock <= 0) return false;
    return true;
  });

  const cards = filtered.slice(0, limit).map((c) => ({
    name: c.name,
    set: c.set,
    rarity: c.rarity,
    price: c.price,
    inStock: c.stock > 0,
    stock: c.stock,
    image: c.image,
    url: `${base}/vibes/cards/${c.id}`,
    market: marketByCard.get(c.id) ?? undefined,
  }));

  return NextResponse.json(
    {
      source: "badgytcg.com",
      updatedAt: new Date().toISOString(),
      count: cards.length,
      cards,
    },
    {
      headers: {
        ...CORS,
        // Cacheable at the edge for 5 min so bursts don't hit the DB.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
