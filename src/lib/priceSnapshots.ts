import { prisma } from "@/lib/prisma";
import { getEffectiveCards, listStockedVariants, listSpecialCards } from "@/lib/catalog";

// Split a (possibly variant/special) card id into its base id + variant label
// for snapshot storage. "eth-foo::arctic" -> { cardId: "eth-foo", variant:
// "arctic" }; "special::abc" -> { cardId: "special::abc", variant: "special" }.
function splitVariant(id: string): { cardId: string; variant: string } {
  if (id.startsWith("special::")) return { cardId: id, variant: "special" };
  const m = id.match(/^(.*)::(foil|arctic|birb|pengu)$/);
  if (m) return { cardId: m[1], variant: m[2] };
  return { cardId: id, variant: "base" };
}

/** Write one price+stock snapshot for every stocked thing (base cards, foils,
 * specials). Called by the daily job. Safe to run repeatedly — history is
 * append-only. */
export async function captureDailySnapshots(): Promise<{ rows: number }> {
  const [base, variants, specials] = await Promise.all([
    getEffectiveCards(),
    listStockedVariants(),
    listSpecialCards(),
  ]);

  const now = new Date();
  const data: { cardId: string; variant: string; priceCents: number; stock: number; capturedAt: Date }[] = [];
  const push = (id: string, price: number, stock: number) => {
    const { cardId, variant } = splitVariant(id);
    data.push({ cardId, variant, priceCents: Math.round(price * 100), stock, capturedAt: now });
  };

  // Only snapshot base cards we actually price/stock (have an override or stock),
  // to avoid 500+ default-priced rows per day.
  for (const c of base) if (c.stock > 0) push(c.id, c.price, c.stock);
  for (const v of variants) push(v.id, v.price, v.stock);
  for (const s of specials) push(s.id, s.price, s.stock);

  if (data.length === 0) return { rows: 0 };
  await prisma.priceSnapshot.createMany({ data });
  return { rows: data.length };
}

/** Record a single snapshot for one card/variant right after an admin edits its
 * price or stock, so history captures intraday changes too. `id` may be a base,
 * variant, or special id. Never throws. */
export async function snapshotCard(id: string, price: number, stock: number): Promise<void> {
  try {
    const { cardId, variant } = splitVariant(id);
    await prisma.priceSnapshot.create({
      data: { cardId, variant, priceCents: Math.round(price * 100), stock },
    });
  } catch (err) {
    console.error("[price snapshot] failed:", err);
  }
}

/** Earliest snapshot timestamp for a card/variant (for "Tracking since <date>"
 * empty states), or null if none yet. */
export async function trackingSince(cardId: string, variant = "base"): Promise<Date | null> {
  const first = await prisma.priceSnapshot.findFirst({
    where: { cardId, variant },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true },
  });
  return first?.capturedAt ?? null;
}
