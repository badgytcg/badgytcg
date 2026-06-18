import { cards } from "@/data/cards";
import { normalizeCardKey } from "@/lib/normalize";
import { Card, DeckImportResult, ParsedDeck, WishlistLine } from "@/lib/types";

const byKey = new Map<string, Card>(cards.map((c) => [normalizeCardKey(c.name), c]));

export function findCardByAnyName(name: string): Card | undefined {
  return byKey.get(normalizeCardKey(name));
}

/** Splits a parsed deck into "we have these in stock" (available, ready for
 * cart) vs "you'll need to hunt these down" (missing, goes to wishlist).
 * `deckPrice` is what you charge for the deck as a bundle; the wishlist
 * lines don't get priced since you haven't sourced them yet. */
export function matchDeckToInventory(deck: ParsedDeck, deckPrice = 0): DeckImportResult {
  const available: DeckImportResult["available"] = [];
  const missing: WishlistLine[] = [];

  for (const entry of deck.entries) {
    const card = findCardByAnyName(entry.name);
    if (!card) {
      missing.push({
        cardName: entry.name,
        cardId: null,
        qty: entry.qty,
        note: `from deck import: ${deck.deckName}`,
      });
      continue;
    }

    const haveQty = Math.min(card.stock, entry.qty);
    const shortQty = entry.qty - haveQty;

    if (haveQty > 0) {
      available.push({ card, qty: haveQty });
    }
    if (shortQty > 0) {
      missing.push({
        cardName: card.name,
        cardId: card.id,
        qty: shortQty,
        note: `from deck import: ${deck.deckName}`,
      });
    }
  }

  return { deckName: deck.deckName, deckPrice, available, missing };
}
