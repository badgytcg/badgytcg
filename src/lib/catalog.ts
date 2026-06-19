import { cards as seedCards } from "@/data/cards";
import { Card } from "@/lib/types";
import { prisma } from "@/lib/prisma";

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

export async function getEffectiveCardById(id: string): Promise<Card | undefined> {
  const override = await prisma.cardOverride.findUnique({ where: { cardId: id } });
  const base = seedCards.find((c) => c.id === id);
  if (!base) return undefined;
  if (!override) return base;
  return { ...base, price: override.price, stock: override.stock };
}
