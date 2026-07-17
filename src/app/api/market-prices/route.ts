import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Bulk fetch for list views (e.g. the Browse Singles grid) so we don't make
// one request per card tile. Card detail pages use /api/cards/[id]/market-prices instead.
// MinMax no longer sells Vibes TCG — excluded from the storefront.
export async function GET() {
  const prices = await prisma.marketPrice.findMany({ where: { source: { not: "minmax" } } });
  return NextResponse.json({ prices });
}
