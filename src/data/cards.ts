import { Card } from "@/lib/types";
import generated from "@/data/cards-generated.json";
import overrides from "@/data/overrides.json";

// Default ask price by rarity for any card you haven't explicitly priced/
// stocked yet in overrides.json. Stock defaults to 0 (out of stock ->
// wishlist) until you confirm you actually have copies.
const DEFAULT_PRICE_BY_RARITY: Record<string, number> = {
  Common: 0.25,
  Uncommon: 0.5,
  Rare: 1.5,
  Mythic: 8.0,
};

type Override = { price: number; stock: number };
const overrideMap = overrides as Record<string, Override>;

interface GeneratedCard {
  id: string;
  identifier: string;
  name: string;
  set: string;
  setCode: string;
  cardNumber: string;
  color: string;
  type: string;
  attribute: string | null;
  ability: string | null;
  cost: number | null;
  vibe: number | null;
  rarity: string;
  image: string;
}

export const cards: Card[] = (generated as GeneratedCard[]).map((c) => {
  const override = overrideMap[c.id];
  return {
    ...c,
    price: override?.price ?? DEFAULT_PRICE_BY_RARITY[c.rarity] ?? 0.5,
    stock: override?.stock ?? 0,
  };
});

export function getCardById(id: string): Card | undefined {
  return cards.find((c) => c.id === id);
}
