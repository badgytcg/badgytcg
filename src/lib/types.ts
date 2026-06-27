export interface Card {
  id: string; // url-safe slug, derived from set + identifier
  identifier: string; // PascalCase id used in deck-code JSON format
  name: string;
  set: string;
  setCode: string;
  cardNumber: string;
  rarity: string;
  color: string; // single color, dual ("Blue Yellow"), or Colorless/Relic/Rod
  type: string;
  attribute: string | null;
  ability: string | null;
  cost: number | null;
  vibe: number | null;
  price: number; // single-card price in USD, from overrides
  stock: number; // singles available, from overrides
  image: string;
  isFoil?: boolean; // true for the synthetic "{baseId}::foil" variant of a card
  isSpecial?: boolean; // true for a one-off SpecialCard (graded slab, rare foil, etc.)
  description?: string | null; // SpecialCard only
  grade?: string | null; // SpecialCard only
}

export interface CartLine {
  cardId: string;
  qty: number;
}

export interface WishlistLine {
  cardName: string; // kept even if card isn't in our catalog at all
  cardId: string | null; // null if not found in catalog
  qty: number;
  note?: string; // e.g. "from deck import: Purple at the Disco"
  dbId?: string; // set when synced from the server (signed-in users only)
}

export interface ParsedDeckEntry {
  name: string;
  qty: number;
}

export interface ParsedDeck {
  deckName: string;
  entries: ParsedDeckEntry[];
}

export interface DeckImportResult {
  deckName: string;
  deckPrice: number; // price you charge for the full pre-built deck
  available: { card: Card; qty: number }[];
  missing: WishlistLine[];
}
