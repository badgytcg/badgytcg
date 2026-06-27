import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public bulk list of which cards have a foil stocked (and at what
// price/stock) — used by the Browse Singles grid to show the variant
// toggle only where a foil actually exists.
export async function GET() {
  const overrides = await prisma.foilOverride.findMany();
  return NextResponse.json({
    foils: overrides.map((o) => ({ cardId: o.cardId, price: o.price, stock: o.stock })),
  });
}
