import { cards as staticCards } from "@/data/cards";
import { normalizeCardKey } from "@/lib/normalize";
import { Card, DeckImportResult, ParsedDeck, WishlistLine } from "@/lib/types";

function buildIndex(catalog: Card[]): Map<string, Card> {
  return new Map(catalog.map((c) => [normalizeCardKey(c.name), c]));
}

const staticIndex = buildIndex(staticCards);

/** Looks up a card by name (case/punctuation-insensitive). Pass `catalog`
 * to match against live (admin-edited) stock instead of the static bundle —
 * e.g. the deck importer fetches `/api/cards` first so it sees current
 * inventory rather than whatever was true at build time. */
export function findCardByAnyName(name: string, catalog?: Card[]): Card | undefined {
  const index = catalog ? buildIndex(catalog) : staticIndex;
  return index.get(normalizeCardKey(name));
}

/** Splits a parsed deck into "we have these in stock" (available, ready for
 * cart) vs "you'll need to hunt these down" (missing, goes to wishlist).
 * `deckPrice` is what you charge for the deck as a bundle; the wishlist
 * lines don't get priced since you haven't sourced them yet. */
export function matchDeckToInventory(deck: ParsedDeck, deckPrice = 0, catalog?: Card[]): DeckImportResult {
  const available: DeckImportResult["available"] = [];
  const missing: WishlistLine[] = [];
  const entries: DeckImportResult["entries"] = [];

  for (const entry of deck.entries) {
    const card = findCardByAnyName(entry.name, catalog);
    entries.push({ card: card ?? null, cardName: entry.name, qty: entry.qty });

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

  return { deckName: deck.deckName, deckPrice, available, missing, entries };
}
