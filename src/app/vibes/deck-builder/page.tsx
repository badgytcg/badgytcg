"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useStore } from "@/context/StoreContext";
import { Card } from "@/lib/types";

const SET_ORDER = ["Enter the Huddle", "Legend of the Lils", "Birb & Pengu"];

export default function DeckBuilderPage() {
  const { addManyToCart, addToWishlist } = useStore();
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [set, setSet] = useState("All");
  const [deckName, setDeckName] = useState("My Custom Deck");
  const [lines, setLines] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => {
        setCatalog(data.cards ?? []);
        setLoading(false);
      });
  }, []);

  const sets = useMemo(() => SET_ORDER.filter((s) => catalog.some((c) => c.set === s)), [catalog]);

  const results = useMemo(() => {
    return catalog
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) && (set === "All" || c.set === set))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [catalog, query, set]);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const deckEntries = useMemo(
    () =>
      Object.entries(lines)
        .filter(([, qty]) => qty > 0)
        .map(([cardId, qty]) => ({ card: byId.get(cardId), qty }))
        .filter((e): e is { card: Card; qty: number } => !!e.card)
        .sort((a, b) => a.card.name.localeCompare(b.card.name)),
    [lines, byId]
  );

  const totalCards = deckEntries.reduce((s, e) => s + e.qty, 0);
  const totalCost = deckEntries.reduce((s, e) => s + e.card.price * e.qty, 0);
  const availableQty = deckEntries.reduce((s, e) => s + Math.min(e.qty, e.card.stock), 0);
  const missingCount = deckEntries.filter((e) => e.qty > e.card.stock).length;

  function setQty(cardId: string, qty: number) {
    setLines((prev) => ({ ...prev, [cardId]: Math.max(0, qty) }));
    setConfirmed(false);
    setRequested(false);
  }

  function addOne(cardId: string) {
    setQty(cardId, (lines[cardId] ?? 0) + 1);
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

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Deck Builder</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Pick cards and quantities to see exactly what your deck would cost. Anything I don&apos;t have
        in stock can go on your wishlist as a deck request.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search card name..."
              className="flex-1 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
            <select
              value={set}
              onChange={(e) => setSet(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="All">All sets</option>
              {sets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {results.length === 0 ? (
            <p className="text-zinc-500">No cards match your search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((card) => {
                const inDeck = lines[card.id] ?? 0;
                return (
                  <button
                    key={card.id}
                    onClick={() => addOne(card.id)}
                    className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-left hover:border-purple-500"
                  >
                    <div className="relative mb-2 h-24 overflow-hidden rounded bg-zinc-800">
                      <Image src={card.image} alt={card.name} fill sizes="120px" className="object-contain" unoptimized />
                      {inDeck > 0 && (
                        <span className="absolute right-1 top-1 rounded-full bg-purple-600 px-1.5 py-0.5 text-xs font-bold text-white">
                          {inDeck}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs font-medium text-zinc-200">{card.name}</p>
                    <p className="text-xs text-zinc-500">
                      ${card.price.toFixed(2)} · {card.stock > 0 ? `${card.stock} in stock` : "out of stock"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="self-start rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:sticky lg:top-28">
          <input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100"
          />

          {deckEntries.length === 0 ? (
            <p className="text-sm text-zinc-500">Click a card on the left to add it.</p>
          ) : (
            <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {deckEntries.map(({ card, qty }) => (
                <li key={card.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-zinc-200">{card.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQty(card.id, qty - 1)}
                      className="h-6 w-6 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-zinc-300">{qty}</span>
                    <button
                      onClick={() => setQty(card.id, qty + 1)}
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
