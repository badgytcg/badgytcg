// Converts data-source/VibesTCG_AllSets_Cleaned.csv into src/data/cards-generated.json.
// Re-run with `npm run build:cards` whenever you drop in an updated CSV export.
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "..", "data-source", "VibesTCG_AllSets_Cleaned.csv");
const outPath = path.join(__dirname, "..", "src", "data", "cards-generated.json");

const SET_NAMES = {
  Eth: "Enter the Huddle",
  Bap: "Birb & Pengu",
  Lotl: "Legend of the Lils",
};

// CSV calls top rarity "Mythic"; the game actually calls it "Epic".
const RARITY_NAMES = {
  Mythic: "Epic",
};

// Excluded entirely: not real sellable singles (token cards, etc).
// Keyed by `${Set}-${CardID}` since some excluded cards share an
// Identifier with another printing (e.g. the two Fishsicle tokens).
// Eth-203 "QR Code" is a digital-pack-of-10/Fishsicle redemption code, not
// a tradeable physical/digital card.
const EXCLUDED_CARDS = new Set(["Eth-202", "Eth-205", "Eth-204", "Eth-203"]);

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Action/Fit cards store cost as a run of colored-pip letters (e.g. "BB",
// "RRR") instead of a number — the card art just shows the pip count, so
// that's what we display too. Character/Relic costs are already numeric.
function parseCost(value) {
  if (value === "" || value === "EMPTY") return null;
  if (/^[0-9]+$/.test(value)) return Number(value);
  if (/^[A-Z]+$/.test(value)) return value.length;
  return null;
}

const raw = readFileSync(csvPath, "utf8");
const allRows = parse(raw, { columns: true, skip_empty_lines: true });
const rows = allRows.filter((row) => !EXCLUDED_CARDS.has(`${row.Set}-${row.CardID}`));

const cards = rows.map((row) => ({
  id: slugify(`${row.Set}-${row.Identifier}`),
  identifier: row.Identifier,
  name: row.Name,
  set: SET_NAMES[row.Set] ?? row.Set,
  setCode: row.Set,
  cardNumber: row.CardID,
  color: row.Color,
  type: row.Type,
  attribute: row.Attribute && row.Attribute !== "EMPTY" ? row.Attribute : null,
  ability: row.Ability || null,
  cost: parseCost(row.Cost),
  vibe: row.Vibe === "" || row.Vibe === "EMPTY" ? null : Number(row.Vibe),
  rarity: RARITY_NAMES[row.Rarity] ?? row.Rarity,
  image: row.imageURL,
}));

writeFileSync(outPath, JSON.stringify(cards, null, 2));
console.log(`Wrote ${cards.length} cards to ${path.relative(process.cwd(), outPath)}`);
