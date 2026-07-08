import { ParsedDeck } from "@/lib/types";

// Accepted plain-text line shapes (tried in order):
//   "4 Card Name"        — quantity first (standard)
//   "Card Name x4"       — name then x<n>
//   "Card Name (4)"      — name then (n)
//   "Card Name *4"       — name then *<n>
//   "Card Name"          — no quantity → defaults to 1
const QTY_FIRST   = /^(\d+)[x*]?\s+(.+)$/i;
const QTY_SUFFIX_X = /^(.+?)\s+[x*](\d+)$/i;
const QTY_SUFFIX_P = /^(.+?)\s+\((\d+)\)$/;

/** Parse a single plain-text line into { name, qty } or null if unrecognisable. */
function parsePlainLine(line: string): { name: string; qty: number } | null {
  let m: RegExpExecArray | null;

  m = QTY_FIRST.exec(line);
  if (m) return { qty: Number(m[1]), name: m[2].trim() };

  m = QTY_SUFFIX_X.exec(line);
  if (m) return { name: m[1].trim(), qty: Number(m[2]) };

  m = QTY_SUFFIX_P.exec(line);
  if (m) return { name: m[1].trim(), qty: Number(m[2]) };

  // Plain name only — anything that looks like a real card name
  const trimmed = line.trim();
  if (trimmed.length >= 2) return { name: trimmed, qty: 1 };

  return null;
}

/** Skip comment / section-header lines that aren't card entries. */
function isSkippableLine(line: string): boolean {
  return (
    line.startsWith("//") ||
    line.startsWith("#") ||
    line.startsWith("--") ||
    /^\[.+\]$/.test(line) ||   // [Sideboard] etc.
    line === ""
  );
}

/** Parses either the JSON `{ deckName, counts }` format or any reasonable
 *  plain-text list format into a single shape we can match against inventory.
 *  Unrecognisable lines are silently skipped rather than throwing. */
export function parseDeckCode(input: string): ParsedDeck {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a deck list first.");

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonFormat(trimmed);
  }
  return parsePlainFormat(trimmed);
}

function parseJsonFormat(trimmed: string): ParsedDeck {
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    // Might be plain text that just happens to start with { — fall through
    return parsePlainFormat(trimmed);
  }

  // Shape 1: { deckName?, counts: { "Card Name": qty } }
  if (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    "counts" in data &&
    typeof (data as Record<string, unknown>).counts === "object"
  ) {
    const obj = data as { deckName?: unknown; counts: Record<string, unknown> };
    const deckName = typeof obj.deckName === "string" ? obj.deckName : "Imported Deck";
    const entries = Object.entries(obj.counts)
      .map(([name, qty]) => ({ name, qty: Math.max(1, Number(qty) || 1) }))
      .filter((e) => e.name);
    if (entries.length === 0) throw new Error("Deck has no cards in counts.");
    return { deckName, entries };
  }

  // Shape 2: [ { name, qty/quantity/count } ]
  if (Array.isArray(data)) {
    const entries = (data as unknown[])
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const obj = item as Record<string, unknown>;
        const name = String(obj.name ?? obj.cardName ?? obj.card ?? "").trim();
        const qty = Math.max(1, Number(obj.qty ?? obj.quantity ?? obj.count ?? 1));
        return name ? { name, qty } : null;
      })
      .filter((e): e is { name: string; qty: number } => e !== null);
    if (entries.length === 0) throw new Error("Couldn't find any cards in that JSON array.");
    return { deckName: "Imported Deck", entries };
  }

  // Shape 3: { "Card Name": qty } flat map
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>)
      .map(([name, qty]) => ({ name, qty: Math.max(1, Number(qty) || 1) }))
      .filter((e) => e.name && isNaN(Number(e.name)));
    if (entries.length > 0) return { deckName: "Imported Deck", entries };
  }

  throw new Error("Couldn't read that JSON format. Expected { deckName, counts } or an array of { name, qty }.");
}

function parsePlainFormat(trimmed: string): ParsedDeck {
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim());

  let deckName = "Imported Deck";
  let startIndex = 0;

  // First non-empty line can be a deck name comment
  if (lines[0]?.startsWith("//") || lines[0]?.startsWith("#")) {
    deckName = lines[0].replace(/^[/#]+\s*/, "").trim() || deckName;
    startIndex = 1;
  }

  const entries: { name: string; qty: number }[] = [];
  for (const line of lines.slice(startIndex)) {
    if (isSkippableLine(line)) continue;
    const parsed = parsePlainLine(line);
    if (parsed) entries.push(parsed);
    // silently skip lines we can't parse
  }

  if (entries.length === 0) {
    throw new Error(
      "No card lines found. Expected lines like \"4 Card Name\", \"Card Name x4\", or just \"Card Name\"."
    );
  }

  return { deckName, entries };
}
