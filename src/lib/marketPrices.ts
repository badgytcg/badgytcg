import { cards } from "@/data/cards";
import { normalizeCardKey } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";
import { variantCardId, VariantKind } from "@/lib/catalog";

interface PriceRow {
  cardId: string;
  source: string;
  label: string;
  price: number;
  currency: string;
  url: string | null;
}

function normalizeSet(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

// Listings we don't track pricing for at all — promos, one-off sketches,
// QR/code cards. These get skipped entirely, not attributed to any variant.
const SKIP_PATTERN = /\b(promo|qr|sketch|ttm)\b/i;
// "Arctic Foil" is checked before plain "foil" since it also contains the word.
const ALT_FOIL_PATTERN = /\barctic foil\b/i;
const FOIL_PATTERN = /\b(holo|foil)\b/i;

/** Pulls a variant tier (if any) out of a listing's name and returns the
 * name with that wording stripped, so the remainder can still be matched
 * against the base card name. Returns null kind for a plain base listing,
 * and `skip: true` for promos/sketches/etc. we don't track at all. */
function detectVariant(text: string): { kind: VariantKind | null; cleaned: string; skip: boolean } {
  if (SKIP_PATTERN.test(text)) return { kind: null, cleaned: text, skip: true };
  if (ALT_FOIL_PATTERN.test(text)) return { kind: "altfoil", cleaned: text.replace(ALT_FOIL_PATTERN, "").trim(), skip: false };
  if (FOIL_PATTERN.test(text)) return { kind: "foil", cleaned: text.replace(FOIL_PATTERN, "").trim(), skip: false };
  return { kind: null, cleaned: text, skip: false };
}

const byNameAndSet = new Map(
  cards.map((c) => [`${normalizeCardKey(c.name)}::${normalizeSet(c.set)}`, c])
);
const bySetCodeAndNumber = new Map(
  cards.map((c) => [`${c.setCode.toLowerCase()}::${c.cardNumber}`, c])
);
const byNameOnly = new Map(cards.map((c) => [normalizeCardKey(c.name), c]));

// MinMax's product-title tag (e.g. "(LOL88)") uses its own short codes,
// which don't all match our setCode field 1:1.
const MINMAX_SET_TAG_MAP: Record<string, string> = { eth: "eth", lol: "lotl", bap: "bap" };

// --- Dyli: real marketplace API, paginated. ---
async function fetchDyliPrices(): Promise<PriceRow[]> {
  const apiKey = process.env.DYLI_API_KEY;
  if (!apiKey) return [];

  const rows: PriceRow[] = [];
  let page = 1;
  const maxPages = 30; // safety cap; ~885 items at page_size 100 is ~9 pages

  while (page <= maxPages) {
    const res = await fetch(
      `https://www.dyli.io/api/public/v1/search?brand=Vibes&category=TCG&subcategory=Ungraded%20Card&page=${page}&page_size=100`,
      { headers: { "x-api-key": apiKey } }
    );
    if (!res.ok) break;
    const data = await res.json();

    for (const item of data.items ?? []) {
      const lastDash = item.name.lastIndexOf(" - ");
      if (lastDash === -1) continue;
      const namePart = item.name.slice(0, lastDash).trim();
      const setPart = item.name.slice(lastDash + 3).trim();

      const { kind, cleaned, skip } = detectVariant(namePart);
      if (skip) continue;

      const card = byNameAndSet.get(`${normalizeCardKey(cleaned)}::${normalizeSet(setPart)}`);
      if (!card) continue;
      const cardId = kind ? variantCardId(card.id, kind) : card.id;

      // Only the resale floor price — that's the actual "what would I pay a
      // collector for this" market price, vs. Dyli's own primary listing.
      if (item.pricing?.secondary?.floor_price) {
        rows.push({
          cardId,
          source: "dyli",
          label: "Dyli",
          price: item.pricing.secondary.floor_price,
          currency: item.pricing.secondary.currency ?? "USDC.e",
          url: item.marketplace_url ?? null,
        });
      }
    }

    if (!data.pagination?.has_more) break;
    page++;
  }

  return rows;
}

// --- MinMax Games: public Shopify storefront JSON feed, paginated. ---
async function fetchMinMaxPrices(): Promise<PriceRow[]> {
  const rows: PriceRow[] = [];
  let page = 1;
  const maxPages = 10; // ~684 products at limit 250 is ~3 pages

  while (page <= maxPages) {
    const res = await fetch(
      `https://www.minmaxgamesfab.com/collections/vibes/products.json?limit=250&page=${page}`
    );
    if (!res.ok) break;
    const data = await res.json();
    const products = data.products ?? [];
    if (products.length === 0) break;

    for (const product of products) {
      const title = (product.title as string).trim();
      // Most base-printing titles end with a tag like "(ETH137)" or
      // "(LOL88)", but plenty (especially Birb & Pengu) have none at all —
      // fall back to a plain name match for those.
      const tagMatch = title.match(/\(([A-Za-z]+)(\d+)\)/);
      const remaining = tagMatch ? title.replace(tagMatch[0], "").trim() : title;

      const { kind, cleaned, skip } = detectVariant(remaining);
      if (skip) continue;

      let card = tagMatch
        ? bySetCodeAndNumber.get(`${MINMAX_SET_TAG_MAP[tagMatch[1].toLowerCase()] ?? ""}::${tagMatch[2]}`)
        : undefined;
      if (!card) card = byNameOnly.get(normalizeCardKey(cleaned));
      if (!card) continue;
      const cardId = kind ? variantCardId(card.id, kind) : card.id;

      const price = Number(product.variants?.[0]?.price);
      if (!Number.isFinite(price)) continue;

      rows.push({
        cardId,
        source: "minmax",
        label: "MinMax Games",
        price,
        currency: "USD",
        url: `https://www.minmaxgamesfab.com/products/${product.handle}`,
      });
    }

    page++;
  }

  return rows;
}

export async function refreshMarketPrices(): Promise<{ dyli: number; minmax: number }> {
  // Drop the old two-row-per-card scheme (primary + secondary) now that we
  // only track the resale floor price under a single "dyli" source.
  await prisma.marketPrice.deleteMany({ where: { source: { in: ["dyli_primary", "dyli_secondary"] } } });

  const [dyliRows, minmaxRows] = await Promise.all([fetchDyliPrices(), fetchMinMaxPrices()]);
  const allRows = [...dyliRows, ...minmaxRows];

  // A card can match more than one listing on a given source (e.g. two
  // separate Dyli drops for the same printing) — keep only the cheapest.
  const lowestByKey = new Map<string, PriceRow>();
  for (const row of allRows) {
    const key = `${row.cardId}::${row.source}`;
    const existing = lowestByKey.get(key);
    if (!existing || row.price < existing.price) lowestByKey.set(key, row);
  }

  for (const row of lowestByKey.values()) {
    await prisma.marketPrice.upsert({
      where: { cardId_source: { cardId: row.cardId, source: row.source } },
      create: row,
      update: { label: row.label, price: row.price, currency: row.currency, url: row.url },
    });
  }

  // Append a history point for every value seen this refresh — this is the
  // only place price history accumulates, so charts/gainers get richer the
  // more often "Refresh Market Prices" is run.
  if (lowestByKey.size > 0) {
    await prisma.marketPriceHistory.createMany({
      data: Array.from(lowestByKey.values()).map((row) => ({
        cardId: row.cardId,
        source: row.source,
        price: row.price,
        currency: row.currency,
      })),
    });
  }

  // Also snapshot our own site prices, so "site" shows up as a trend too.
  const { getEffectiveCards } = await import("@/lib/catalog");
  const siteCards = await getEffectiveCards();
  await prisma.marketPriceHistory.createMany({
    data: siteCards.filter((c) => c.stock > 0).map((c) => ({ cardId: c.id, source: "site", price: c.price, currency: "USD" })),
  });

  return { dyli: dyliRows.length, minmax: minmaxRows.length };
}

export async function getMarketPrices(cardId: string) {
  return prisma.marketPrice.findMany({ where: { cardId }, orderBy: { source: "asc" } });
}

export async function getPriceHistory(cardId: string) {
  return prisma.marketPriceHistory.findMany({
    where: { cardId },
    orderBy: { recordedAt: "asc" },
  });
}
