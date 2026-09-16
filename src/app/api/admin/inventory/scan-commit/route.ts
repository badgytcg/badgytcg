import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveCards } from "@/lib/catalog";
import { logAdminAction } from "@/lib/audit";

// Commit a whole scan session at once. Body: { items: [{ cardId, qty }] }.
// Quantities are ADDED to current stock (fresh read here, so a stale scan-time
// count can't clobber a concurrent edit). Cards are matched by exact id since
// the scanner already resolved them.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { items } = await request.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Expected { items: [{cardId, qty}] }" }, { status: 400 });
  }

  const effective = await getEffectiveCards();
  const byId = new Map(effective.map((c) => [c.id, c]));

  const updated: { cardId: string; name: string; qty: number; newStock: number }[] = [];
  const unmatched: string[] = [];
  let totalCards = 0;

  for (const raw of items) {
    const cardId = String(raw?.cardId ?? "");
    const qty = Math.max(0, Math.round(Number(raw?.qty) || 0));
    const card = byId.get(cardId);
    if (!card || qty <= 0) {
      if (cardId) unmatched.push(cardId);
      continue;
    }
    const newStock = card.stock + qty;
    await prisma.cardOverride.upsert({
      where: { cardId },
      create: { cardId, price: card.price, stock: newStock },
      update: { stock: newStock },
    });
    card.stock = newStock; // in case the same id appears twice in the payload
    updated.push({ cardId, name: card.name, qty, newStock });
    totalCards += qty;
  }

  if (updated.length > 0) {
    await logAdminAction({
      adminEmail: session!.user!.email!,
      action: "inventory.scan_commit",
      detail: `Scan session: +${totalCards} card(s) across ${updated.length} title(s)`,
      request,
    });
  }

  return NextResponse.json({ updated, unmatched });
}
