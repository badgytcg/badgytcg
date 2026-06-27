import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { cards } from "@/data/cards";
import { VARIANT_KINDS, VariantKind, VARIANT_LABEL } from "@/lib/catalog";

// Lists every foil/alt-foil override that exists, joined with its base
// card's name/image/set for display. Adding a *new* variant (one that
// doesn't have a row yet) is done via PATCH with any cardId + kind.
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const overrides = await prisma.cardVariantOverride.findMany();
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const rows = overrides
    .map((o) => {
      const base = cardMap.get(o.cardId);
      if (!base) return null;
      return {
        cardId: o.cardId,
        kind: o.kind as VariantKind,
        kindLabel: VARIANT_LABEL[o.kind as VariantKind] ?? o.kind,
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

  const { cardId, kind, price, stock } = await request.json();
  if (
    typeof cardId !== "string" ||
    typeof price !== "number" ||
    typeof stock !== "number" ||
    !VARIANT_KINDS.includes(kind)
  ) {
    return NextResponse.json({ error: "Expected { cardId, kind: 'foil'|'altfoil', price, stock }" }, { status: 400 });
  }
  if (!cards.some((c) => c.id === cardId)) {
    return NextResponse.json({ error: "Unknown cardId" }, { status: 400 });
  }

  const override = await prisma.cardVariantOverride.upsert({
    where: { cardId_kind: { cardId, kind } },
    create: { cardId, kind, price, stock },
    update: { price, stock },
  });
  return NextResponse.json({ override });
}
