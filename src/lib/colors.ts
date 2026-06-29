// Dual-color cards (e.g. "Purple Green" for Build a Burrito) used to match
// against both individual color filters, which double-counted them and
// threw off inventory-by-color browsing. They're grouped under a single
// "Multi-color" category instead — this is purely a display/filter
// grouping, the underlying card.color data (which reflects the game's
// actual dual-color rules) is untouched.
const COLORLESS_ALIASES = new Set(["Brown", "Beige"]);

interface ColorCategoryInput {
  color: string;
  set?: string;
  attribute?: string | null;
}

// The Legend of the Lils Relic-Wizard cards (Half Past Chill, Glow and
// Behold, Feather Forecast, Potion Commotion, Glass Act) are tagged
// Colorless in the source data, but should browse as Multi-color.
function isLotlRelicWizard(card: ColorCategoryInput): boolean {
  return card.set === "Legend of the Lils" && card.attribute === "Wizard";
}

export function colorCategory(card: ColorCategoryInput): string {
  if (isLotlRelicWizard(card)) return "Multi-color";
  const trimmed = (card.color ?? "").trim();
  if (!trimmed) return "Colorless";
  if (trimmed.includes(" ")) return "Multi-color";
  if (COLORLESS_ALIASES.has(trimmed)) return "Colorless";
  return trimmed;
}

export function colorCategories(cards: ColorCategoryInput[]): string[] {
  return Array.from(new Set(cards.map(colorCategory)));
}
