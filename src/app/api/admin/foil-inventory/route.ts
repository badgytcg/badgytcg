import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { cards } from "@/data/cards";

// Lists every foil override that exists, joined with its base card's name/
// image/set for display. Adding a *new* foil (one that doesn't have a row
// yet) is done via PATCH with any cardId from the base catalog.
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const overrides = await prisma.foilOverride.findMany();
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const rows = overrides
    .map((o) => {
      const base = cardMap.get(o.cardId);
      if (!base) return null;
      return {
        cardId: o.cardId,
        name: base.name,
        set: base.set,
        image: base.image,
        price: o.price,
        stock: o.stock,
      };
    })
    .filter((r) => r !== null);

  return NextResponse.json({ rows });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cardId, price, stock } = await request.json();
  if (typeof cardId !== "string" || typeof price !== "number" || typeof stock !== "number") {
    return NextResponse.json({ error: "Expected { cardId, price, stock }" }, { status: 400 });
  }
  if (!cards.some((c) => c.id === cardId)) {
    return NextResponse.json({ error: "Unknown cardId" }, { status: 400 });
  }

  const override = await prisma.foilOverride.upsert({
    where: { cardId },
    create: { cardId, price, stock },
    update: { price, stock },
  });
  return NextResponse.json({ override });
}
