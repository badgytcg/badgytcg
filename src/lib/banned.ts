import { normalizeCardKey } from "@/lib/normalize";

// Cards banned in competitive Vibes TCG play, per the official ban
// announcement (Sept 18, 2026): https://www.vibes.game/blog/vibes-tcg-ban-announcement
// Names are the exact catalog spellings so matching is reliable. Starter
// decks remain legal out of the box even if they contain a banned card.
export const BAN_ANNOUNCEMENT_URL = "https://www.vibes.game/blog/vibes-tcg-ban-announcement";

const BANNED_NAMES = [
  "Inspiring Story",
  "Chaos Birb",
  "On Thin Ice",
  "Colosseum",
  "Penguin That Doesn't Mind Goodbyes",
  "Bizmo, PhD Candidate",
  "A Drop in Attention",
];

const BANNED_KEYS = new Set(BANNED_NAMES.map(normalizeCardKey));

// True if this card name is on the competitive ban list. Variant suffixes
// like " (Foil)" are ignored since a foil of a banned card is still banned.
export function isBannedCardName(name: string | null | undefined): boolean {
  if (!name) return false;
  const base = name.replace(/\s*\((Foil|Alt Foil)\)\s*$/i, "");
  return BANNED_KEYS.has(normalizeCardKey(base));
}
