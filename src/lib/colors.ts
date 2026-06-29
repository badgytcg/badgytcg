// Dual-color cards (e.g. "Purple Green" for Build a Burrito) used to match
// against both individual color filters, which double-counted them and
// threw off inventory-by-color browsing. They're grouped under a single
// "Multi-color" category instead — this is purely a display/filter
// grouping, the underlying card.color data (which reflects the game's
// actual dual-color rules) is untouched.
export function colorCategory(color: string): string {
  return color.includes(" ") ? "Multi-color" : color;
}

export function colorCategories(colors: string[]): string[] {
  return Array.from(new Set(colors.map(colorCategory)));
}
