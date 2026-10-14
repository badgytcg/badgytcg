import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveCards, DEFAULT_FOIL_PRICE, VARIANT_KINDS, setAllowsTreatment, type VariantKind } from "@/lib/catalog";
import { logAdminAction } from "@/lib/audit";

// Commit a whole scan session at once.
// Body: { items: [{ cardId, qty, kind? }] } where kind is "base" (default) or a
// foil treatment (foil / arctic / birb / pengu). A foil treatment is only
// applied if the card's set actually has it (e.g. Arctic Foil only for Legend
// of the Lils) — mismatches are returned in `rejected`. Quantities are ADDED to
// current stock (fresh read here, so a stale scan-time count can't clobber a
// concurrent edit). Base cards go to CardOverride; foils go to
// CardVariantOverride, created at the base card's price if new.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { items } = await request.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Expected { items: [{cardId, qty, kind?}] }" }, { status: 400 });
  }

  const effective = await getEffectiveCards();
  const byId = new Map(effective.map((c) => [c.id, c]));
  const baseStock = new Map<string, number>();          // running base stock per card
  const variantStock = new Map<string, number>();       // running foil stock per cardId::kind

  const updated: { cardId: string; name: string; kind: string; qty: number; newStock: number }[] = [];
  const unmatched: string[] = [];
  const rejected: { cardId: string; name: string; kind: string; set: string }[] = [];
  let totalCards = 0;

  for (const raw of items) {
    const cardId = String(raw?.cardId ?? "");
    const qty = Math.max(0, Math.round(Number(raw?.qty) || 0));
    const kind = (VARIANT_KINDS as readonly string[]).includes(raw?.kind) ? (raw.kind as string) : "base";
    const card = byId.get(cardId);
    if (!card || qty <= 0) {
      if (cardId) unmatched.push(cardId);
      continue;
    }

    // Guard foil treatments against the card's set — don't stock an
    // impossible variant (e.g. an Arctic Foil of an Enter the Huddle card).
    if (kind !== "base" && !setAllowsTreatment(card.setCode, kind as VariantKind)) {
      rejected.push({ cardId, name: card.name, kind, set: card.set });
      continue;
    }

    if (kind === "base") {
      const current = baseStock.get(cardId) ?? card.stock;
      const newStock = current + qty;
      await prisma.cardOverride.upsert({
        where: { cardId },
        create: { cardId, price: card.price, stock: newStock },
        update: { stock: newStock },
      });
      baseStock.set(cardId, newStock);
      updated.push({ cardId, name: card.name, kind, qty, newStock });
    } else {
      const key = `${cardId}::${kind}`;
      let current = variantStock.get(key);
      if (current === undefined) {
        const existing = await prisma.cardVariantOverride.findUnique({ where: { cardId_kind: { cardId, kind } } });
        current = existing?.stock ?? 0;
      }
      const newStock = current + qty;
      const existingPrice = (await prisma.cardVariantOverride.findUnique({ where: { cardId_kind: { cardId, kind } } }))?.price;
      await prisma.cardVariantOverride.upsert({
        where: { cardId_kind: { cardId, kind } },
        create: { cardId, kind, price: existingPrice ?? DEFAULT_FOIL_PRICE, stock: newStock },
        update: { stock: newStock },
      });
      variantStock.set(key, newStock);
      updated.push({ cardId, name: card.name, kind, qty, newStock });
    }
    totalCards += qty;
  }

  let sessionId: string | null = null;
  if (updated.length > 0) {
    // Persist the session so the admin can review exactly what a scan added.
    const saved = await prisma.scanSession.create({
      data: {
        adminEmail: session!.user!.email!,
        totalCards,
        items: {
          create: updated.map((u) => ({
            cardId: u.cardId,
            cardName: u.name,
            kind: u.kind,
            qty: u.qty,
            newStock: u.newStock,
          })),
        },
      },
    });
    sessionId = saved.id;

    await logAdminAction({
      adminEmail: session!.user!.email!,
      action: "inventory.scan_commit",
      detail: `Scan session: +${totalCards} card(s) across ${updated.length} entr(ies)`,
      refId: sessionId,
      request,
    });
  }

  return NextResponse.json({ updated, unmatched, rejected, sessionId });
}
