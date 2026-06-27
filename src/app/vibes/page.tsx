"use client";

import { useEffect, useMemo, useState } from "react";
import { cards } from "@/data/cards";
import { Card } from "@/lib/types";
import CardTile from "@/components/CardTile";
import { useStore } from "@/context/StoreContext";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

interface MarketPrice {
  cardId: string;
  source: string;
  label: string;
  price: number;
  currency: string;
}

// "Relic"/"Rod" show up in the Color column for non-colored cards, but
// they're really Types, not colors — exclude them from the color filter.
const NON_COLORS = new Set(["Relic", "Rod"]);
// "???" is a handful of joke cards (Wut?, Wen?, Y?) with no real category.
const NON_TYPES = new Set(["???"]);
const ATTRIBUTE_GROUPS = ["Birb", "Lil", "Penguin"];

const SET_ORDER = ["Enter the Huddle", "Legend of the Lils", "Birb & Pengu"];
const SETS = SET_ORDER.filter((s) => cards.some((c) => c.set === s));

const COLORS = Array.from(
  new Set(cards.flatMap((c) => c.color.split(" ")).filter((c) => !NON_COLORS.has(c)))
).sort((a, b) => {
  if (a === "Colorless") return 1;
  if (b === "Colorless") return -1;
  return a.localeCompare(b);
});
const TYPES = Array.from(new Set(cards.map((c) => c.type))).filter((t) => !NON_TYPES.has(t)).sort();
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic"];
const RARITIES = RARITY_ORDER.filter((r) => cards.some((c) => c.rarity === r));

function attributeGroupsFor(card: { attribute: string | null }): string[] {
  if (!card.attribute) return [];
  return ATTRIBUTE_GROUPS.filter((g) => card.attribute!.includes(g));
}

type SortKey = "name" | "cost-asc" | "cost-desc" | "vibe-asc" | "vibe-desc" | "rarity";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                active
                  ? "border-purple-500 bg-purple-600/20 text-purple-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function VibesBrowsePage() {
  const { addManyToCart, addToWishlist } = useStore();

  // Seed with the static bundle so the page isn't blank while the live
  // (admin-editable) price/stock data loads from the database.
  const [liveCards, setLiveCards] = useState<Card[]>(cards);
  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => setLiveCards(data.cards ?? cards));
  }, []);

  const [marketPricesByCard, setMarketPricesByCard] = useState<Record<string, MarketPrice[]>>({});
  useEffect(() => {
    fetch("/api/market-prices")
      .then((res) => res.json())
      .then((data) => {
        const grouped: Record<string, MarketPrice[]> = {};
        for (const mp of data.prices ?? []) {
          (grouped[mp.cardId] ??= []).push(mp);
        }
        setMarketPricesByCard(grouped);
      });
  }, []);

  const [variantsByCardId, setVariantsByCardId] = useState<
    Record<string, Partial<Record<"foil" | "altfoil", { price: number; stock: number }>>>
  >({});
  useEffect(() => {
    fetch("/api/foils")
      .then((res) => res.json())
      .then((data) => {
        const grouped: Record<string, Partial<Record<"foil" | "altfoil", { price: number; stock: number }>>> = {};
        for (const f of data.foils ?? []) {
          (grouped[f.cardId] ??= {})[f.kind as "foil" | "altfoil"] = { price: f.price, stock: f.stock };
        }
        setVariantsByCardId(grouped);
      });
  }, []);

  // Foil ("{id}::foil") deck lines aren't in liveCards — fetch and cache
  // them individually as they're added so the deck panel can display them.
  const [extraDeckCards, setExtraDeckCards] = useState<Record<string, Card>>({});

  const [query, setQuery] = useState("");
  const [sets, setSets] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [attributeGroups, setAttributeGroups] = useState<string[]>([]);
  const [costMin, setCostMin] = useState("");
  const [costMax, setCostMax] = useState("");
  const [vibeMin, setVibeMin] = useState("");
  const [vibeMax, setVibeMax] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);

  // The deck being built as the customer browses — entirely separate from
  // the "buy this one card right now" flow on a card's own detail page.
  const [deckName, setDeckName] = useState("My Custom Deck");
  const [deckLines, setDeckLines] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [requested, setRequested] = useState(false);

  const filtered = useMemo(() => {
    const result = liveCards.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesSet = sets.length === 0 || sets.includes(c.set);
      const cardColors = c.color.split(" ");
      const matchesColor = colors.length === 0 || colors.some((col) => cardColors.includes(col));
      const matchesType = types.length === 0 || types.includes(c.type);
      const matchesRarity = rarities.length === 0 || rarities.includes(c.rarity);
      const matchesAttribute =
        attributeGroups.length === 0 ||
        attributeGroups.some((g) => attributeGroupsFor(c).includes(g));
      const matchesStock = !inStockOnly || c.stock > 0;
      const matchesCostMin = costMin === "" || (c.cost ?? -Infinity) >= Number(costMin);
      const matchesCostMax = costMax === "" || (c.cost ?? Infinity) <= Number(costMax);
      const matchesVibeMin = vibeMin === "" || (c.vibe ?? -Infinity) >= Number(vibeMin);
      const matchesVibeMax = vibeMax === "" || (c.vibe ?? Infinity) <= Number(vibeMax);
      return (
        matchesQuery &&
        matchesSet &&
        matchesColor &&
        matchesType &&
        matchesRarity &&
        matchesAttribute &&
        matchesStock &&
        matchesCostMin &&
        matchesCostMax &&
        matchesVibeMin &&
        matchesVibeMax
      );
    });

    const sorted = [...result];
    switch (sort) {
      case "cost-asc":
        sorted.sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
        break;
      case "cost-desc":
        sorted.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
        break;
      case "vibe-asc":
        sorted.sort((a, b) => (a.vibe ?? 0) - (b.vibe ?? 0));
        break;
      case "vibe-desc":
        sorted.sort((a, b) => (b.vibe ?? 0) - (a.vibe ?? 0));
        break;
      case "rarity":
        sorted.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [liveCards, query, sets, colors, types, rarities, attributeGroups, costMin, costMax, vibeMin, vibeMax, inStockOnly, sort]);

  // Jump back to page 1 whenever the result set changes underneath the user.
  useEffect(() => {
    setPage(1);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function clearFilters() {
    setQuery("");
    setSets([]);
    setColors([]);
    setTypes([]);
    setRarities([]);
    setAttributeGroups([]);
    setCostMin("");
    setCostMax("");
    setVibeMin("");
    setVibeMax("");
    setInStockOnly(false);
    setSort("name");
  }

  const byId = useMemo(() => {
    const map = new Map(liveCards.map((c) => [c.id, c]));
    for (const [id, c] of Object.entries(extraDeckCards)) map.set(id, c);
    return map;
  }, [liveCards, extraDeckCards]);

  const deckEntries = useMemo(
    () =>
      Object.entries(deckLines)
        .filter(([, qty]) => qty > 0)
        .map(([cardId, qty]) => ({ card: byId.get(cardId), qty }))
        .filter((e): e is { card: Card; qty: number } => !!e.card)
        .sort((a, b) => a.card.name.localeCompare(b.card.name)),
    [deckLines, byId]
  );

  const totalCards = deckEntries.reduce((s, e) => s + e.qty, 0);
  const totalCost = deckEntries.reduce((s, e) => s + e.card.price * e.qty, 0);
  const availableQty = deckEntries.reduce((s, e) => s + Math.min(e.qty, e.card.stock), 0);
  const missingCount = deckEntries.filter((e) => e.qty > e.card.stock).length;

  function setDeckQty(cardId: string, qty: number) {
    setDeckLines((prev) => ({ ...prev, [cardId]: Math.max(0, qty) }));
    setConfirmed(false);
    setRequested(false);
  }

  function addOneToDeck(cardId: string) {
    setDeckQty(cardId, (deckLines[cardId] ?? 0) + 1);
    if (!byId.has(cardId)) {
      fetch(`/api/cards/${encodeURIComponent(cardId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.card) setExtraDeckCards((prev) => ({ ...prev, [cardId]: data.card }));
        });
    }
  }

  function handleAddToCart() {
    const available = deckEntries
      .map((e) => ({ cardId: e.card.id, qty: Math.min(e.qty, e.card.stock) }))
      .filter((l) => l.qty > 0);
    const missing = deckEntries
      .filter((e) => e.qty > e.card.stock)
      .map((e) => ({
        cardName: e.card.name,
        cardId: e.card.id,
        qty: e.qty - e.card.stock,
        note: `Deck request: ${deckName}`,
      }));

    addManyToCart(available);
    if (missing.length > 0) addToWishlist(missing);
    setConfirmed(true);
  }

  function handleRequestWholeDeck() {
    addToWishlist(
      deckEntries.map((e) => ({
        cardName: e.card.name,
        cardId: e.card.id,
        qty: e.qty,
        note: `Deck request: ${deckName}`,
      }))
    );
    setRequested(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Browse Vibes Singles</h1>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr_320px]">
        <aside className="self-start rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search card name..."
            className="mb-5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />

          <FilterGroup title="Set" options={SETS} selected={sets} onToggle={(v) => setSets(toggle(sets, v))} />
          <FilterGroup title="Color" options={COLORS} selected={colors} onToggle={(v) => setColors(toggle(colors, v))} />
          <FilterGroup title="Type" options={TYPES} selected={types} onToggle={(v) => setTypes(toggle(types, v))} />
          <FilterGroup title="Rarity" options={RARITIES} selected={rarities} onToggle={(v) => setRarities(toggle(rarities, v))} />
          <FilterGroup title="Attribute" options={ATTRIBUTE_GROUPS} selected={attributeGroups} onToggle={(v) => setAttributeGroups(toggle(attributeGroups, v))} />

          <div className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cost</h3>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={costMin} onChange={(e) => setCostMin(e.target.value)} placeholder="Min" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" />
              <span className="text-zinc-500">–</span>
              <input type="number" min={0} value={costMax} onChange={(e) => setCostMax(e.target.value)} placeholder="Max" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" />
            </div>
          </div>

          <div className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Vibe</h3>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={vibeMin} onChange={(e) => setVibeMin(e.target.value)} placeholder="Min" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" />
              <span className="text-zinc-500">–</span>
              <input type="number" min={0} value={vibeMax} onChange={(e) => setVibeMax(e.target.value)} placeholder="Max" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" />
            </div>
          </div>

          <label className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            In stock only
          </label>

          <button onClick={clearFilters} className="w-full rounded-lg border border-zinc-700 py-1.5 text-sm text-zinc-300 hover:border-purple-500">
            Clear filters
          </button>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">{filtered.length} card(s)</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                Show
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                at a time
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
              >
                <option value="name">Name A–Z</option>
                <option value="cost-asc">Cost: Low to High</option>
                <option value="cost-desc">Cost: High to Low</option>
                <option value="vibe-asc">Vibe: Low to High</option>
                <option value="vibe-desc">Vibe: High to Low</option>
                <option value="rarity">Rarity</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-zinc-500">No cards match your filters.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {paged.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    getQtyInDeck={(id) => deckLines[id] ?? 0}
                    onAdd={addOneToDeck}
                    getMarketPrices={(id) => marketPricesByCard[id] ?? []}
                    variants={variantsByCardId[card.id]}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-zinc-400">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="self-start rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:sticky lg:top-28">
          <input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100"
          />

          {deckEntries.length === 0 ? (
            <p className="text-sm text-zinc-500">Click &quot;Add to deck&quot; on any card to start building.</p>
          ) : (
            <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {deckEntries.map(({ card, qty }) => (
                <li key={card.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-zinc-200">{card.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDeckQty(card.id, qty - 1)}
                      className="h-6 w-6 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-zinc-300">{qty}</span>
                    <button
                      onClick={() => setDeckQty(card.id, qty + 1)}
                      className="h-6 w-6 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-zinc-800 pt-4 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Cards</span>
              <span>{totalCards}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>In stock</span>
              <span className={availableQty === totalCards ? "text-green-400" : "text-yellow-400"}>
                {availableQty} / {totalCards}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-lg font-semibold text-zinc-100">
              <span>Total</span>
              <span className="text-purple-300">${totalCost.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={handleAddToCart}
              disabled={deckEntries.length === 0 || confirmed}
              className="rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {confirmed ? "Added!" : "Buy what's in stock"}
            </button>
            {missingCount > 0 && (
              <button
                onClick={handleRequestWholeDeck}
                disabled={deckEntries.length === 0 || requested}
                className="rounded-lg border border-zinc-700 py-2 text-sm font-medium text-zinc-300 hover:border-purple-500 hover:text-purple-300 disabled:opacity-40"
              >
                {requested ? "Requested!" : "♡ Request entire deck instead"}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
