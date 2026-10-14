import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveCardById, setAllowsTreatment, VARIANT_KINDS, type VariantKind } from "@/lib/catalog";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/foil-inventory/reclassify — move a stocked variant from one
// foil treatment to another (e.g. a legacy Birb & Pengu "foil" row into "birb"
// or "pengu"). Body: { cardId, fromKind, toKind }. Price/stock carry over; if
// the target already exists, stock is added. toKind must be valid for the
// card's set.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { cardId, fromKind, toKind } = await request.json();
  if (typeof cardId !== "string" || !(VARIANT_KINDS as readonly string[]).includes(fromKind) || !(VARIANT_KINDS as readonly string[]).includes(toKind)) {
    return NextResponse.json({ error: "Expected { cardId, fromKind, toKind }" }, { status: 400 });
  }
  if (fromKind === toKind) {
    return NextResponse.json({ error: "Pick a different treatment." }, { status: 400 });
  }

  const card = await getEffectiveCardById(cardId);
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }
  if (!setAllowsTreatment(card.setCode, toKind as VariantKind)) {
    return NextResponse.json({ error: `${card.set} cards can't be ${toKind}.` }, { status: 400 });
  }

  const source = await prisma.cardVariantOverride.findUnique({ where: { cardId_kind: { cardId, kind: fromKind } } });
  if (!source) {
    return NextResponse.json({ error: "No stock to reclassify for that treatment." }, { status: 404 });
  }

  const target = await prisma.cardVariantOverride.findUnique({ where: { cardId_kind: { cardId, kind: toKind } } });
  await prisma.$transaction([
    prisma.cardVariantOverride.upsert({
      where: { cardId_kind: { cardId, kind: toKind } },
      // Keep the target's price if it already exists; otherwise carry the source price.
      create: { cardId, kind: toKind, price: source.price, stock: source.stock },
      update: { stock: (target?.stock ?? 0) + source.stock },
    }),
    prisma.cardVariantOverride.delete({ where: { cardId_kind: { cardId, kind: fromKind } } }),
  ]);

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "foil.reclassify",
    detail: `Reclassified ${card.name} foil: ${fromKind} → ${toKind} (${source.stock} in stock)`,
    request,
  });

  return NextResponse.json({ ok: true });
}
