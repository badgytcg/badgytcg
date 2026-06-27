import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public bulk list of which cards have a foil/alt-foil stocked (and at what
// price/stock) — used by the Browse Singles grid to show the variant
// toggle only where a variant actually exists.
export async function GET() {
  const overrides = await prisma.cardVariantOverride.findMany();
  return NextResponse.json({
    foils: overrides.map((o) => ({ cardId: o.cardId, kind: o.kind, price: o.price, stock: o.stock })),
  });
}
