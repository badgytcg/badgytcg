import { cards as seedCards } from "@/data/cards";
import { Card } from "@/lib/types";
import { prisma } from "@/lib/prisma";

const SPECIAL_PREFIX = "special::";

export const VARIANT_KINDS = ["foil", "altfoil"] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export const VARIANT_LABEL: Record<VariantKind, string> = {
  foil: "Foil",
  altfoil: "Alt Foil",
};

function parseVariantId(id: string): { baseId: string; kind: VariantKind } | null {
  for (const kind of VARIANT_KINDS) {
    const suffix = `::${kind}`;
    if (id.endsWith(suffix)) return { baseId: id.slice(0, -suffix.length), kind };
  }
  return null;
}

// Live admin-edited price/stock (CardOverride table) takes priority over
// the static seed data in src/data/cards.ts. This is the source of truth
// the storefront should read from — it reflects whatever the admin most
// recently set via /admin/inventory, without needing a redeploy.
export async function getEffectiveCards(): Promise<Card[]> {
  const dbOverrides = await prisma.cardOverride.findMany();
  const overrideMap = new Map(dbOverrides.map((o) => [o.cardId, o]));

  return seedCards.map((card) => {
    const override = overrideMap.get(card.id);
    if (!override) return card;
    return { ...card, price: override.price, stock: override.stock };
  });
}

/** Resolves a base card id, a variant id ("{baseId}::foil" / "{baseId}::altfoil"),
 * or a special/graded card id ("special::{cuid}") to its effective Card shape.
 * Variant/special ids are a separate namespace from the regular catalog so
 * they never show up in the main browse grid or bulk /api/cards response. */
export async function getEffectiveCardById(id: string): Promise<Card | undefined> {
  if (id.startsWith(SPECIAL_PREFIX)) {
    const special = await prisma.specialCard.findUnique({
      where: { id: id.slice(SPECIAL_PREFIX.length) },
    });
    if (!special) return undefined;
    return specialToCard(special);
  }

  const parsed = parseVariantId(id);
  if (parsed) {
    const base = seedCards.find((c) => c.id === parsed.baseId);
    if (!base) return undefined;
    const variant = await prisma.cardVariantOverride.findUnique({
      where: { cardId_kind: { cardId: parsed.baseId, kind: parsed.kind } },
    });
    if (!variant) return undefined; // no stock for this variant — toggle shouldn't even show
    return {
      ...base,
      id,
      name: `${base.name} (${VARIANT_LABEL[parsed.kind]})`,
      price: variant.price,
      stock: variant.stock,
      isFoil: true,
    };
  }

  const override = await prisma.cardOverride.findUnique({ where: { cardId: id } });
  const base = seedCards.find((c) => c.id === id);
  if (!base) return undefined;
  if (!override) return base;
  return { ...base, price: override.price, stock: override.stock };
}

interface SpecialCardRow {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  price: number;
  grade: string | null;
  set: string | null;
  qty: number;
}

function specialToCard(special: SpecialCardRow): Card {
  return {
    id: `${SPECIAL_PREFIX}${special.id}`,
    identifier: special.id,
    name: special.name,
    set: special.set ?? "Special",
    setCode: "Special",
    cardNumber: "",
    rarity: special.grade ?? "Graded",
    color: "Colorless",
    type: "Special",
    attribute: null,
    ability: null,
    cost: null,
    vibe: null,
    price: special.price,
    stock: special.qty,
    image: special.imageUrl,
    isSpecial: true,
    description: special.description,
    grade: special.grade,
  };
}

export async function listSpecialCards(): Promise<Card[]> {
  const rows = await prisma.specialCard.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(specialToCard);
}

/** Every currently-stocked foil/alt-foil, as full Card objects — used by
 * the admin inventory print report so variants show up alongside base cards. */
export async function listStockedVariants(): Promise<Card[]> {
  const overrides = await prisma.cardVariantOverride.findMany();
  const baseById = new Map(seedCards.map((c) => [c.id, c]));

  return overrides
    .map((o): Card | null => {
      const base = baseById.get(o.cardId);
      if (!base) return null;
      return {
        ...base,
        id: variantCardId(o.cardId, o.kind as VariantKind),
        name: `${base.name} (${VARIANT_LABEL[o.kind as VariantKind]})`,
        price: o.price,
        stock: o.stock,
        isFoil: true,
      };
    })
    .filter((c): c is Card => c !== null);
}

export function variantCardId(baseId: string, kind: VariantKind): string {
  return `${baseId}::${kind}`;
}

export function specialCardId(id: string): string {
  return `${SPECIAL_PREFIX}${id}`;
}

/** Called once per purchased line after a successful checkout. Branches by
 * id namespace: a one-off special card is removed entirely (it's sold, no
 * such thing as restocking it), a foil/alt-foil decrements its own
 * CardVariantOverride row, and a regular card decrements CardOverride as before. */
export async function decrementStockAfterPurchase(cardId: string, qty: number): Promise<void> {
  if (cardId.startsWith(SPECIAL_PREFIX)) {
    await prisma.specialCard.deleteMany({ where: { id: cardId.slice(SPECIAL_PREFIX.length) } });
    return;
  }

  const parsed = parseVariantId(cardId);
  if (parsed) {
    const variant = await prisma.cardVariantOverride.findUnique({
      where: { cardId_kind: { cardId: parsed.baseId, kind: parsed.kind } },
    });
    if (!variant) return;
    await prisma.cardVariantOverride.update({
      where: { cardId_kind: { cardId: parsed.baseId, kind: parsed.kind } },
      data: { stock: Math.max(0, variant.stock - qty) },
    });
    return;
  }

  const current = await getEffectiveCardById(cardId);
  if (!current) return;
  await prisma.cardOverride.upsert({
    where: { cardId },
    create: { cardId, price: current.price, stock: Math.max(0, current.stock - qty) },
    update: { stock: Math.max(0, current.stock - qty) },
  });
}
