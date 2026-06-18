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
}

export interface CartLine {
  cardId: string;
  qty: number;
}

export interface WishlistLine {
  cardName: string; // kept even if card isn't in DB at all
  cardId: string | null; // null if not found in DB
  qty: number;
  note?: string; // e.g. "from deck import: Purple at the Disco"
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
