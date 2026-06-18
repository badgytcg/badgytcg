"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { parseDeckCode } from "@/lib/deckParser";
import { matchDeckToInventory } from "@/lib/inventory";
import { DeckImportResult } from "@/lib/types";

const PLACEHOLDER = `// Purple at the Disco
4 Get Rekt
1 Lil Waker
2 Mount Fuji
2 Prized Birb
3 Iron Penguin
...`;

// What you charge for a full pre-built deck, regardless of singles pricing.
const DECK_BUNDLE_PRICE = 35;

export default function DeckImportPage() {
  const { addManyToCart, addToWishlist } = useStore();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DeckImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleParse() {
    setError(null);
    setResult(null);
    setConfirmed(false);
    try {
      const deck = parseDeckCode(code);
      const matched = matchDeckToInventory(deck, DECK_BUNDLE_PRICE);
      setResult(matched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't parse that deck code.");
    }
  }

  function handleConfirm() {
    if (!result) return;
    addManyToCart(
      result.available.map((a) => ({ cardId: a.card.id, qty: a.qty }))
    );
    if (result.missing.length > 0) {
      addToWishlist(result.missing);
    }
    setConfirmed(true);
  }

  const totalRequested = result
    ? result.available.reduce((s, a) => s + a.qty, 0) + result.missing.reduce((s, m) => s + m.qty, 0)
    : 0;
  const haveCount = result ? result.available.reduce((s, a) => s + a.qty, 0) : 0;
  const isComplete = result ? result.missing.length === 0 : false;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Import a Deck Code</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Paste a deck list in either format — the plain text export or the JSON{" "}
        <code className="rounded bg-zinc-800 px-1">{"{ deckName, counts }"}</code> format.
        I&apos;ll add what I have in stock to your cart for ${DECK_BUNDLE_PRICE} flat for the deck,
        and put anything missing on a wishlist for me to track down.
      </p>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={12}
        className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
      />

      <button
        onClick={handleParse}
        className="mt-4 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
      >
        Check Deck
      </button>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">{result.deckName}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {haveCount} / {totalRequested} cards in stock.{" "}
            {isComplete ? (
              <span className="text-green-400">Full deck available!</span>
            ) : (
              <span className="text-yellow-400">{result.missing.length} card type(s) need sourcing.</span>
            )}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-green-400">In stock → cart</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.available.map((a) => (
                  <li key={a.card.id}>{a.qty}x {a.card.name}</li>
                ))}
                {result.available.length === 0 && <li className="text-zinc-500">None</li>}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-yellow-400">Missing → wishlist</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {result.missing.map((m, i) => (
                  <li key={i}>{m.qty}x {m.cardName}</li>
                ))}
                {result.missing.length === 0 && <li className="text-zinc-500">None</li>}
              </ul>
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-400">
            Deck price: <span className="font-semibold text-purple-300">${DECK_BUNDLE_PRICE.toFixed(2)}</span>{" "}
            for everything in stock{result.missing.length > 0 ? " (missing cards billed separately once sourced)." : "."}
          </p>

          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="mt-4 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
          >
            {confirmed ? "Added!" : "Add deck to cart + wishlist"}
          </button>
        </div>
      )}
    </div>
  );
}
