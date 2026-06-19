"use client";

import { useEffect, useMemo, useState } from "react";
import { cards } from "@/data/cards";
import CardTile from "@/components/CardTile";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

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

  const filtered = useMemo(() => {
    const result = cards.filter((c) => {
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
  }, [query, sets, colors, types, rarities, attributeGroups, costMin, costMax, vibeMin, vibeMax, inStockOnly, sort]);

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Browse Vibes Singles</h1>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {paged.map((card) => (
                  <CardTile key={card.id} card={card} />
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
      </div>
    </div>
  );
}
