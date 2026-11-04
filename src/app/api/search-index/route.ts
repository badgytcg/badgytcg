import { NextResponse } from "next/server";
import { getEffectiveCards } from "@/lib/catalog";
import { allDecks } from "@/lib/metaDecks";

export const dynamic = "force-dynamic";

// Compact index for the client-side command palette. Small enough (~550 cards
// + ~120 decks) to search in the browser with Fuse.js, so there's no server
// round-trip per keystroke. Revalidated at the edge every 2 min so prices and
// stock stay fresh without hammering the DB.
export async function GET() {
  const [cards, decks] = await Promise.all([getEffectiveCards(), allDecks()]);

  const cardIndex = cards.map((c) => ({
    id: c.id,
    name: c.name,
    set: c.set,
    rarity: c.rarity,
    color: c.color,
    price: c.price,
    stock: c.stock,
    image: c.image,
  }));

  const deckIndex = decks.map((d) => ({
    key: d.key,
    name: d.name,
    author: d.author,
    source: d.source,
    external: d.external,
    href: d.viewHref,
    colors: d.colors,
    archetype: d.archetype,
    totalCents: d.totalCents,
  }));

  return NextResponse.json(
    { updatedAt: new Date().toISOString(), cards: cardIndex, decks: deckIndex },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
  );
}
