import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { cards } from "@/data/cards";
import { getEffectiveCards } from "@/lib/catalog";
import { colorCategory } from "@/lib/colors";

const FLOOR_SOURCES = new Set(["dyli", "minmax", "scg"]);
const SOURCE_LABEL: Record<string, string> = { dyli: "Dyli", minmax: "MinMax", scg: "StarCityGames" };

// Bulk price update scoped to a set/rarity filter — never touches cards
// outside that filter. mode "fixed" applies a flat price to every match;
// mode "<source>" (dyli/minmax/scg) sets each matched card's price to its
// own current floor price from that market source (skipping any card that
// doesn't have one), so two cards in the same batch can end up with
// different prices.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { set, rarity, color, mode, price } = body as {
    set?: string | null;
    rarity?: string | null;
    color?: string | null;
    mode: "fixed" | "dyli" | "minmax" | "scg";
    price?: number;
  };

  if (mode !== "fixed" && !FLOOR_SOURCES.has(mode)) {
    return NextResponse.json({ error: "mode must be 'fixed', 'dyli', 'minmax', or 'scg'" }, { status: 400 });
  }
  if (mode === "fixed" && (typeof price !== "number" || price < 0)) {
    return NextResponse.json({ error: "price is required for mode 'fixed'" }, { status: 400 });
  }

  const matching = cards.filter(
    (c) =>
      (!set || c.set === set) &&
      (!rarity || c.rarity === rarity) &&
      (!color || colorCategory(c) === color)
  );
  if (matching.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0 });
  }

  const effective = await getEffectiveCards();
  const stockById = new Map(effective.map((c) => [c.id, c.stock]));

  let updated = 0;
  let skipped = 0;

  if (mode === "fixed") {
    for (const c of matching) {
      const stock = stockById.get(c.id) ?? 0;
      await prisma.cardOverride.upsert({
        where: { cardId: c.id },
        create: { cardId: c.id, price: price!, stock },
        update: { price: price! },
      });
      updated++;
    }
  } else {
    const floorPrices = await prisma.marketPrice.findMany({
      where: { source: mode, cardId: { in: matching.map((c) => c.id) } },
    });
    const floorByCardId = new Map(floorPrices.map((p) => [p.cardId, p.price]));

    for (const c of matching) {
      const floorPrice = floorByCardId.get(c.id);
      if (floorPrice == null) {
        skipped++;
        continue;
      }
      const stock = stockById.get(c.id) ?? 0;
      await prisma.cardOverride.upsert({
        where: { cardId: c.id },
        create: { cardId: c.id, price: floorPrice, stock },
        update: { price: floorPrice },
      });
      updated++;
    }
  }

  return NextResponse.json({ updated, skipped, sourceLabel: mode !== "fixed" ? SOURCE_LABEL[mode] : undefined });
}
