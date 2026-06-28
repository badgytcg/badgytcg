import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parseDeckCode } from "@/lib/deckParser";
import { findCardByAnyName } from "@/lib/inventory";
import { getEffectiveCards } from "@/lib/catalog";

// Bulk-adds stock from a pasted list — same "4 Get Rekt" plain-text or
// { deckName, counts } JSON format as the customer-facing deck importer.
// Quantities are ADDED to current stock, not set, so pasting the same
// physical pile twice would double-count it.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text } = await request.json();
  if (typeof text !== "string") {
    return NextResponse.json({ error: "Expected { text }" }, { status: 400 });
  }

  let deck;
  try {
    deck = parseDeckCode(text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't parse that list." }, { status: 400 });
  }

  const effective = await getEffectiveCards();
  const stockById = new Map(effective.map((c) => [c.id, c.stock]));
  const priceById = new Map(effective.map((c) => [c.id, c.price]));

  const updated: { name: string; qty: number; newStock: number }[] = [];
  const unmatched: { name: string; qty: number }[] = [];

  for (const entry of deck.entries) {
    const card = findCardByAnyName(entry.name);
    if (!card) {
      unmatched.push({ name: entry.name, qty: entry.qty });
      continue;
    }

    const currentStock = stockById.get(card.id) ?? 0;
    const newStock = currentStock + entry.qty;
    await prisma.cardOverride.upsert({
      where: { cardId: card.id },
      create: { cardId: card.id, price: priceById.get(card.id) ?? card.price, stock: newStock },
      update: { stock: newStock },
    });
    stockById.set(card.id, newStock); // so a repeated line in the same paste stacks correctly
    updated.push({ name: card.name, qty: entry.qty, newStock });
  }

  return NextResponse.json({ updated, unmatched });
}
