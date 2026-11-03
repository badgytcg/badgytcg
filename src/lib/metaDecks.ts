import { getEffectiveCards } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { parseDeckCode } from "@/lib/deckParser";
import { normalizeCardKey } from "@/lib/normalize";
import { colorCategory } from "@/lib/colors";
import { Card } from "@/lib/types";
import rawVibes from "@/data/vibesdecks-raw.json";

// ---------------------------------------------------------------------------
// "Played in these meta decks" data layer.
//
// Merges three deck sources into one card -> decks index, computing each
// deck's color pips, archetype, total price (at OUR live prices) and
// in-stock counts so the numbers match the cart:
//
//   1. Your own FeaturedDeck rows (type meta/starter)      -> "BadgyTCG"
//   2. Harvested vibesdecks.com decks (src/data JSON)       -> "via Vibes Decks"
//   3. Manual "via Vibes Decks" decks (FeaturedDeck type="vibes",
//      with {author,url} packed into the description field) -> "via Vibes Decks"
//
// No DB schema change: harvested decks live in the committed JSON; manual
// imports reuse the existing FeaturedDeck table.
// ---------------------------------------------------------------------------

// vibesdecks' unpriced "???" section occasionally mis-spells a card. Map the
// obvious ones to our normalized key; anything still unmatched is logged and
// simply not shown (never a broken link).
const NAME_ALIASES: Record<string, string> = {
  mtfuji: "mountfuji",
  penguinsoffallingleaves: "penguinofthefallingleaves",
  penguinwhodoesntmindgoodbyes: "penguinthatdoesntmindgoodbyes",
};

const ARCHETYPES = ["Aggro", "Control", "Midrange", "Tempo", "Combo", "Mill", "Ramp", "Starter"];

interface RawEntry { name: string; count: number }
interface RawVibesDeck { slug: string; name: string; author: string | null; url: string; cards: RawEntry[] }

export interface DeckCardLine {
  cardId: string | null;
  name: string;
  count: number;
  inStock: number; // copies of this card we can actually fill (min stock, count)
}

export interface MetaDeckView {
  key: string;
  source: "badgytcg" | "vibesdecks";
  external: boolean;
  name: string;
  author: string | null;
  deckUrl: string | null;   // external vibesdecks url (new tab) for "via Vibes Decks"
  viewHref: string;         // where "View deck" goes
  colors: string[];         // color-category names, most common first (max 3)
  archetype: string | null;
  totalCents: number;       // deck value at our prices (matched cards only)
  inStockCopies: number;    // copies we can fill
  totalCopies: number;      // total copies in the deck
  copiesOfCard: number;     // copies of the card this section is for
  cards: DeckCardLine[];    // full resolved list (for "Buy full deck")
  popularity: number;       // sort weight within a source
}

interface DeckSource {
  key: string;
  source: "badgytcg" | "vibesdecks";
  external: boolean;
  name: string;
  author: string | null;
  deckUrl: string | null;
  viewHref: string;
  popularity: number;
  entries: RawEntry[];
}

function archetypeFromName(name: string): string | null {
  const low = name.toLowerCase();
  for (const a of ARCHETYPES) if (low.includes(a.toLowerCase())) return a;
  return null;
}

// Pull {author,url} back out of a manual vibes deck's description field.
function parseVibesMeta(description: string | null): { author: string | null; url: string | null } {
  if (!description) return { author: null, url: null };
  try {
    const o = JSON.parse(description);
    if (o && typeof o === "object") return { author: o.author ?? null, url: o.url ?? null };
  } catch { /* plain text description — no structured meta */ }
  return { author: null, url: null };
}

async function loadDeckSources(): Promise<DeckSource[]> {
  const sources: DeckSource[] = [];

  // 1 + 3. FeaturedDeck rows.
  let featured: Awaited<ReturnType<typeof prisma.featuredDeck.findMany>> = [];
  try {
    featured = await prisma.featuredDeck.findMany({ where: { active: true } });
  } catch (err) {
    console.error("[metaDecks] featuredDeck load failed:", err);
  }
  for (const d of featured) {
    let entries: RawEntry[] = [];
    try {
      entries = parseDeckCode(d.cardList).entries.map((e) => ({ name: e.name, count: e.qty }));
    } catch { continue; }
    if (d.type === "vibes") {
      const meta = parseVibesMeta(d.description);
      sources.push({
        key: `badgy-vibes:${d.id}`,
        source: "vibesdecks",
        external: !!meta.url,
        name: d.name,
        author: meta.author,
        deckUrl: meta.url,
        viewHref: meta.url ?? `/vibes/decks/${d.id}`,
        popularity: 1000 + d.sortOrder, // manual imports float above harvested
        entries,
      });
    } else {
      sources.push({
        key: `badgy:${d.id}`,
        source: "badgytcg",
        external: false,
        name: d.name,
        author: null,
        deckUrl: null,
        viewHref: `/vibes/decks/${d.id}`,
        popularity: -d.sortOrder,
        entries,
      });
    }
  }

  // 2. Harvested vibesdecks decks (skip any slug a manual import already covers).
  const manualUrls = new Set(sources.filter((s) => s.deckUrl).map((s) => s.deckUrl));
  for (const d of rawVibes as RawVibesDeck[]) {
    if (manualUrls.has(d.url)) continue;
    sources.push({
      key: `vibes:${d.slug}`,
      source: "vibesdecks",
      external: true,
      name: d.name,
      author: d.author,
      deckUrl: d.url,
      viewHref: d.url,
      popularity: 0,
      entries: d.cards,
    });
  }

  return sources;
}

// Resolve a deck's raw entries against the live catalog and compute display
// stats. `index` maps normalized name/identifier -> Card.
function buildDeckView(src: DeckSource, index: Map<string, Card>): MetaDeckView {
  const cards: DeckCardLine[] = [];
  let totalCents = 0, inStockCopies = 0, totalCopies = 0;
  const colorCount = new Map<string, number>();

  for (const e of src.entries) {
    const key = normalizeCardKey(e.name);
    const card = index.get(key) ?? index.get(NAME_ALIASES[key] ?? "");
    totalCopies += e.count;
    if (!card) {
      if (process.env.NODE_ENV !== "production") console.warn(`[metaDecks] unmatched card "${e.name}" in ${src.name}`);
      cards.push({ cardId: null, name: e.name, count: e.count, inStock: 0 });
      continue;
    }
    const fillable = Math.min(card.stock, e.count);
    totalCents += Math.round(card.price * 100) * e.count;
    inStockCopies += fillable;
    cards.push({ cardId: card.id, name: card.name, count: e.count, inStock: fillable });
    const cat = colorCategory(card);
    if (cat !== "Colorless") colorCount.set(cat, (colorCount.get(cat) ?? 0) + e.count);
  }

  const colors = [...colorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);

  return {
    key: src.key,
    source: src.source,
    external: src.external,
    name: src.name,
    author: src.author,
    deckUrl: src.deckUrl,
    viewHref: src.viewHref,
    colors,
    archetype: archetypeFromName(src.name),
    totalCents,
    inStockCopies,
    totalCopies,
    copiesOfCard: 0, // filled per-card by decksForCard
    cards,
    popularity: src.popularity,
  };
}

interface BuiltIndex { byCard: Map<string, MetaDeckView[]>; builtAt: number }
let cache: BuiltIndex | null = null;
const TTL_MS = 60_000;

async function getIndex(): Promise<BuiltIndex> {
  if (cache && Date.now() - cache.builtAt < TTL_MS) return cache;

  const [catalog, sources] = await Promise.all([getEffectiveCards(), loadDeckSources()]);
  const index = new Map<string, Card>();
  for (const c of catalog) {
    index.set(normalizeCardKey(c.name), c);
    index.set(normalizeCardKey(c.identifier), c);
  }

  const byCard = new Map<string, MetaDeckView[]>();
  for (const src of sources) {
    const view = buildDeckView(src, index);
    const seenForDeck = new Set<string>();
    for (const line of view.cards) {
      if (!line.cardId || seenForDeck.has(line.cardId)) continue;
      seenForDeck.add(line.cardId);
      const list = byCard.get(line.cardId) ?? [];
      list.push({ ...view, copiesOfCard: line.count });
      byCard.set(line.cardId, list);
    }
  }

  cache = { byCard, builtAt: Date.now() };
  return cache;
}

/** Decks that contain `cardId`, own decks first, then vibesdecks by popularity.
 * Returns up to `limit` (the UI shows 6 with a "Show more"). */
export async function decksForCard(cardId: string, limit = 12): Promise<MetaDeckView[]> {
  const { byCard } = await getIndex();
  const decks = byCard.get(cardId) ?? [];
  const sorted = [...decks].sort((a, b) => {
    if (a.source !== b.source) return a.source === "badgytcg" ? -1 : 1;
    if (b.popularity !== a.popularity) return b.popularity - a.popularity;
    return b.inStockCopies - a.inStockCopies; // popularity proxy: more shoppable first
  });
  return sorted.slice(0, limit);
}
