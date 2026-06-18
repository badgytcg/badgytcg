/** Strips everything but letters/numbers and lowercases, so "Lil Waker",
 * "LilWaker", and "lil-waker" all collapse to the same key. This is what
 * lets us match both deck-code formats (plain text names and the
 * PascalCase `counts` keys) against the card database. */
export function normalizeCardKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
