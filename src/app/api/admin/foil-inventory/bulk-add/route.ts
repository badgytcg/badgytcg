import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parseDeckCode } from "@/lib/deckParser";
import { findCardByAnyName } from "@/lib/inventory";
import { VARIANT_KINDS } from "@/lib/catalog";

// Bulk-adds foil/alt-foil stock from a pasted list — same "4 Get Rekt"
// format as the customer-facing deck importer. Quantities are ADDED to
// current variant stock, not set. All lines in one paste use the same kind.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, kind } = await request.json();
  if (typeof text !== "string" || !VARIANT_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Expected { text, kind: 'foil'|'altfoil' }" }, { status: 400 });
  }

  let deck;
  try {
    deck = parseDeckCode(text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't parse that list." }, { status: 400 });
  }

  const updated: { name: string; qty: number; newStock: number }[] = [];
  const unmatched: { name: string; qty: number }[] = [];

  for (const entry of deck.entries) {
    const card = findCardByAnyName(entry.name);
    if (!card) {
      unmatched.push({ name: entry.name, qty: entry.qty });
      continue;
    }

    const existing = await prisma.cardVariantOverride.findUnique({
      where: { cardId_kind: { cardId: card.id, kind } },
    });
    const newStock = (existing?.stock ?? 0) + entry.qty;
    await prisma.cardVariantOverride.upsert({
      where: { cardId_kind: { cardId: card.id, kind } },
      create: { cardId: card.id, kind, price: existing?.price ?? card.price, stock: newStock },
      update: { stock: newStock },
    });
    updated.push({ name: card.name, qty: entry.qty, newStock });
  }

  return NextResponse.json({ updated, unmatched });
}
