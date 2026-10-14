import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parseDeckCode } from "@/lib/deckParser";
import { findCardByAnyName } from "@/lib/inventory";
import { VARIANT_KINDS, DEFAULT_FOIL_PRICE, setAllowsTreatment, type VariantKind } from "@/lib/catalog";

// Bulk-adds foil stock from a pasted list — same "4 Get Rekt" format as the
// customer-facing deck importer. Quantities are ADDED to current variant
// stock, not set. All lines in one paste use the same treatment, and a card is
// only stocked in it if its set has that treatment (e.g. Arctic Foil only for
// Legend of the Lils); off-set cards come back in `wrongSet`.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, kind } = await request.json();
  if (typeof text !== "string" || !(VARIANT_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Expected { text, kind: foil|arctic|birb|pengu }" }, { status: 400 });
  }
  const treatment = kind as VariantKind;

  let deck;
  try {
    deck = parseDeckCode(text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't parse that list." }, { status: 400 });
  }

  const updated: { name: string; qty: number; newStock: number }[] = [];
  const unmatched: { name: string; qty: number }[] = [];
  const wrongSet: { name: string; qty: number; set: string }[] = [];

  for (const entry of deck.entries) {
    const card = findCardByAnyName(entry.name);
    if (!card) {
      unmatched.push({ name: entry.name, qty: entry.qty });
      continue;
    }
    if (!setAllowsTreatment(card.setCode, treatment)) {
      wrongSet.push({ name: card.name, qty: entry.qty, set: card.set });
      continue;
    }

    const existing = await prisma.cardVariantOverride.findUnique({
      where: { cardId_kind: { cardId: card.id, kind: treatment } },
    });
    const newStock = (existing?.stock ?? 0) + entry.qty;
    await prisma.cardVariantOverride.upsert({
      where: { cardId_kind: { cardId: card.id, kind: treatment } },
      create: { cardId: card.id, kind: treatment, price: existing?.price ?? DEFAULT_FOIL_PRICE, stock: newStock },
      update: { stock: newStock },
    });
    updated.push({ name: card.name, qty: entry.qty, newStock });
  }

  return NextResponse.json({ updated, unmatched, wrongSet });
}
