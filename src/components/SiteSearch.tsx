"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";

interface CardHit {
  id: string; name: string; set: string; rarity: string; color: string;
  price: number; stock: number; image: string;
}
interface DeckHit {
  key: string; name: string; author: string | null; source: "badgytcg" | "vibesdecks";
  external: boolean; href: string; colors: string[]; archetype: string | null; totalCents: number;
}
interface Index { cards: CardHit[]; decks: DeckHit[]; fetchedAt: number }

type Item =
  | { kind: "card"; card: CardHit; domId: string }
  | { kind: "deck"; deck: DeckHit; domId: string }
  | { kind: "seeAll"; domId: string };

const RARITY_RANK: Record<string, number> = { Epic: 0, Rare: 1, Uncommon: 2, Common: 3 };
const COLOR_PIP: Record<string, string> = {
  Yellow: "bg-yellow-400", Red: "bg-red-500", Blue: "bg-blue-500", Green: "bg-green-500",
  Purple: "bg-purple-500", "Multi-color": "bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500", Colorless: "bg-zinc-500",
};
const RECENT_KEY = "badgy_recent_searches";
const INDEX_TTL = 120_000;

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

// Token-AND matching: every whitespace-separated word in the query must appear
// somewhere in the item's searchable text. This makes scattered multi-word
// queries work ("bunkus stars" -> "Bunkus, Who Is the Stars", "popcorn peng"
// -> "Popcorn Penguin"), which a single whole-string fuzzy match misses.
function norm(s: string) { return s.replace(/[^a-z0-9]/gi, "").toLowerCase(); }
function queryTokens(q: string) { return q.trim().toLowerCase().split(/\s+/).map(norm).filter(Boolean); }

function tokenScore(name: string, extra: string, toks: string[]): number {
  const n = norm(name);
  const full = n + norm(extra);
  let score = 0;
  for (const t of toks) {
    if (n.startsWith(t)) score += 3;
    else if (n.includes(t)) score += 2;
    else if (full.includes(t)) score += 1;
    else return -1; // this token isn't present anywhere -> not a match
  }
  return score;
}

// Merge token matches (primary) with Fuse matches (typo tolerance), deduped.
function mergeHits<T>(tokenRanked: T[], fuse: T[], keyOf: (t: T) => string, limit: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const x of [...tokenRanked, ...fuse]) {
    const k = keyOf(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 6); } catch { return []; }
}
function pushRecent(q: string) {
  if (!q.trim()) return;
  try {
    const cur = loadRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...cur].slice(0, 6)));
  } catch { /* private mode */ }
}

export default function SiteSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Index | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const loadIndex = useCallback(async () => {
    if (index && Date.now() - index.fetchedAt < INDEX_TTL) return;
    try {
      const data = await fetch("/api/search-index").then((r) => r.json());
      setIndex({ cards: data.cards ?? [], decks: data.decks ?? [], fetchedAt: Date.now() });
    } catch { /* leave previous index */ }
  }, [index]);

  const openPalette = useCallback(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement;
    setOpen(true);
    setQuery("");
    setActive(0);
    setRecent(loadRecent());
    loadIndex();
  }, [loadIndex]);

  const closePalette = useCallback(() => {
    setOpen(false);
    restoreFocusRef.current?.focus?.();
  }, []);

  // Global shortcuts: Cmd/Ctrl+K toggles; "/" opens when not typing elsewhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); open ? closePalette() : openPalette(); return; }
      if (!open && e.key === "/") {
        const el = e.target as HTMLElement;
        const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
        if (!typing) { e.preventDefault(); openPalette(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openPalette, closePalette]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); }, [open]);

  const cardFuse = useMemo(
    () => index && new Fuse(index.cards, { keys: [{ name: "name", weight: 3 }, "set", "rarity", "color"], threshold: 0.4, ignoreLocation: true, minMatchCharLength: 1 }),
    [index]
  );
  const deckFuse = useMemo(
    () => index && new Fuse(index.decks, { keys: [{ name: "name", weight: 3 }, "author", "archetype"], threshold: 0.4, ignoreLocation: true, minMatchCharLength: 1 }),
    [index]
  );

  const q = query.trim();
  const cardHits = useMemo<CardHit[]>(() => {
    if (!index) return [];
    if (!q) return [...index.cards].filter((c) => c.stock > 0).sort((a, b) => (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9) || b.price - a.price).slice(0, 6);
    const toks = queryTokens(q);
    const tokenRanked = index.cards
      .map((c) => ({ c, s: tokenScore(c.name, `${c.set} ${c.rarity} ${c.color}`, toks) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || b.c.stock - a.c.stock)
      .map((x) => x.c);
    const fuse = (cardFuse?.search(q, { limit: 6 }) ?? []).map((r) => r.item);
    return mergeHits(tokenRanked, fuse, (c) => c.id, 6);
  }, [q, index, cardFuse]);

  const deckHits = useMemo<DeckHit[]>(() => {
    if (!index || !q) return [];
    const toks = queryTokens(q);
    const tokenRanked = index.decks
      .map((d) => ({ d, s: tokenScore(d.name, `${d.author ?? ""} ${d.archetype ?? ""}`, toks) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.d);
    const fuse = (deckFuse?.search(q, { limit: 4 }) ?? []).map((r) => r.item);
    return mergeHits(tokenRanked, fuse, (d) => d.key, 4);
  }, [q, index, deckFuse]);

  // Flat, keyboard-navigable item list.
  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    cardHits.forEach((c, i) => list.push({ kind: "card", card: c, domId: `s-card-${i}` }));
    deckHits.forEach((d, i) => list.push({ kind: "deck", deck: d, domId: `s-deck-${i}` }));
    if (q) list.push({ kind: "seeAll", domId: "s-seeall" });
    return list;
  }, [cardHits, deckHits, q]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`#${items[active]?.domId}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, items]);

  const goCard = useCallback((c: CardHit) => { pushRecent(q || c.name); closePalette(); router.push(`/vibes/cards/${c.id}`); }, [q, closePalette, router]);
  const goDeck = useCallback((d: DeckHit) => {
    pushRecent(q || d.name); closePalette();
    if (d.external) window.open(d.href, "_blank", "noopener,noreferrer"); else router.push(d.href);
  }, [q, closePalette, router]);
  const seeAll = useCallback(() => { pushRecent(q); closePalette(); router.push(`/vibes?q=${encodeURIComponent(q)}`); }, [q, closePalette, router]);

  const activate = useCallback((it: Item) => {
    if (it.kind === "card") goCard(it.card);
    else if (it.kind === "deck") goDeck(it.deck);
    else seeAll();
  }, [goCard, goDeck, seeAll]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); closePalette(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = items[active]; if (it) activate(it); }
  }

  const popularCards = !q && cardHits.length > 0;

  return (
    <>
      {/* Header trigger — box on desktop, icon on mobile */}
      <button
        onClick={openPalette}
        aria-label="Search cards and decks"
        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-400 hover:border-purple-500/60 hover:text-zinc-200"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search cards, decks…</span>
        <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 text-[10px] text-zinc-400 sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-0 sm:p-6 sm:pt-[12vh]" onMouseDown={closePalette}>
          <div
            className="flex h-full w-full flex-col overflow-hidden bg-zinc-950 shadow-2xl ring-1 ring-zinc-800 sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search cards and decks…"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls="site-search-list"
                aria-activedescendant={items[active]?.domId}
                autoComplete="off"
                className="w-full bg-transparent py-3.5 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              <button onClick={closePalette} aria-label="Close search" className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-300">Esc</button>
            </div>

            <div ref={listRef} id="site-search-list" role="listbox" className="flex-1 overflow-y-auto overscroll-contain p-2">
              {/* Empty state: recent + popular */}
              {!q && recent.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Recent</p>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                    {recent.map((r) => (
                      <button key={r} onClick={() => setQuery(r)} className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:border-purple-500 hover:text-zinc-200">{r}</button>
                    ))}
                  </div>
                </div>
              )}

              {cardHits.length > 0 && (
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{popularCards ? "Popular cards" : "Cards"}</p>
              )}
              {cardHits.map((c, i) => {
                const it = items.findIndex((x) => x.kind === "card" && x.card.id === c.id);
                return (
                  <button
                    key={c.id}
                    id={`s-card-${i}`}
                    role="option"
                    aria-selected={active === it}
                    onMouseEnter={() => setActive(it)}
                    onClick={() => goCard(c)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${active === it ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt="" className="h-11 w-9 shrink-0 rounded object-cover" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">{c.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{c.set} · {c.rarity}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums text-purple-300">${c.price.toFixed(2)}</span>
                      <span className={`block text-[11px] ${c.stock > 0 ? "text-green-400" : "text-zinc-600"}`}>{c.stock > 0 ? `${c.stock} in stock` : "Out of stock"}</span>
                    </span>
                  </button>
                );
              })}

              {deckHits.length > 0 && (
                <p className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Decks</p>
              )}
              {deckHits.map((d, i) => {
                const it = items.findIndex((x) => x.kind === "deck" && x.deck.key === d.key);
                return (
                  <button
                    key={d.key}
                    id={`s-deck-${i}`}
                    role="option"
                    aria-selected={active === it}
                    onMouseEnter={() => setActive(it)}
                    onClick={() => goDeck(d)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${active === it ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                  >
                    <span className="flex shrink-0 items-center gap-1">
                      {d.colors.length ? d.colors.map((c) => <span key={c} className={`h-2.5 w-2.5 rounded-full ${COLOR_PIP[c] ?? "bg-zinc-500"}`} />) : <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">{d.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{d.source === "badgytcg" ? "BadgyTCG deck" : `via Vibes Decks${d.author ? ` · ${d.author}` : ""}`}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-purple-300">{money(d.totalCents)}</span>
                  </button>
                );
              })}

              {q && (
                <button
                  id="s-seeall"
                  role="option"
                  aria-selected={active === items.length - 1}
                  onMouseEnter={() => setActive(items.length - 1)}
                  onClick={seeAll}
                  className={`mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm ${active === items.length - 1 ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                >
                  <span className="text-zinc-300">See all results for &quot;{q}&quot;</span>
                  <span className="text-zinc-600">↵</span>
                </button>
              )}

              {q && cardHits.length === 0 && deckHits.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-zinc-500">No cards or decks match &quot;{q}&quot;.</p>
              )}
              {!index && <p className="px-3 py-8 text-center text-sm text-zinc-600">Loading…</p>}
            </div>

            <div className="hidden items-center gap-4 border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600 sm:flex">
              <span><kbd className="rounded border border-zinc-700 px-1">↑</kbd><kbd className="ml-0.5 rounded border border-zinc-700 px-1">↓</kbd> navigate</span>
              <span><kbd className="rounded border border-zinc-700 px-1">↵</kbd> open</span>
              <span><kbd className="rounded border border-zinc-700 px-1">esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-zinc-500" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
