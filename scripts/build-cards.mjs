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

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const raw = readFileSync(csvPath, "utf8");
const rows = parse(raw, { columns: true, skip_empty_lines: true });

const cards = rows.map((row) => ({
  id: slugify(`${row.Set}-${row.Identifier}`),
  identifier: row.Identifier,
  name: row.Name,
  set: SET_NAMES[row.Set] ?? row.Set,
  setCode: row.Set,
  cardNumber: row.CardID,
  color: row.Color,
  type: row.Type,
  attribute: row.Attribute || null,
  ability: row.Ability || null,
  cost: row.Cost === "" ? null : Number(row.Cost),
  vibe: row.Vibe === "" ? null : Number(row.Vibe),
  rarity: RARITY_NAMES[row.Rarity] ?? row.Rarity,
  image: row.imageURL,
}));

writeFileSync(outPath, JSON.stringify(cards, null, 2));
console.log(`Wrote ${cards.length} cards to ${path.relative(process.cwd(), outPath)}`);
