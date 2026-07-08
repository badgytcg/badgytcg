import { ParsedDeck } from "@/lib/types";

const PLAIN_LINE = /^(\d+)\s+(.+)$/;

/** Parses either the JSON `{ deckName, counts }` format or the plain-text
 * "4 Get Rekt" list format (with an optional leading "// Deck Name" comment
 * line) into a single shape we can match against inventory. */
export function parseDeckCode(input: string): ParsedDeck {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste a deck code first.");
  }

  if (trimmed.startsWith("{")) {
    return parseJsonFormat(trimmed);
  }
  return parsePlainFormat(trimmed);
}

function parseJsonFormat(trimmed: string): ParsedDeck {
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error("That looks like JSON but it didn't parse. Check for a missing brace or comma.");
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("counts" in data) ||
    typeof (data as Record<string, unknown>).counts !== "object"
  ) {
    throw new Error('Expected a JSON object with "deckName" and "counts".');
  }

  const obj = data as { deckName?: unknown; counts: Record<string, unknown> };
  const deckName = typeof obj.deckName === "string" ? obj.deckName : "Imported Deck";

  const entries = Object.entries(obj.counts).map(([name, qty]) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid quantity for "${name}" in counts.`);
    }
    return { name, qty: n };
  });

  if (entries.length === 0) {
    throw new Error("Deck has no cards in counts.");
  }

  return { deckName, entries };
}

function parsePlainFormat(trimmed: string): ParsedDeck {
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let deckName = "Imported Deck";
  let startIndex = 0;
  if (lines[0]?.startsWith("//")) {
    deckName = lines[0].replace(/^\/\/\s*/, "").trim() || deckName;
    startIndex = 1;
  }

  const entries = lines.slice(startIndex).map((line) => {
    const match = PLAIN_LINE.exec(line);
    if (!match) {
      throw new Error(`Couldn't read line: "${line}". Expected format "4 Card Name".`);
    }
    return { name: match[2].trim(), qty: Number(match[1]) };
  });

  if (entries.length === 0) {
    throw new Error("Deck has no card lines.");
  }

  return { deckName, entries };
}
