"use client";

import { useEffect, useState } from "react";
import { Card } from "@/lib/types";

interface RequestItem {
  id: string;
  cardId: string | null;
  cardName: string;
  qty: number;
  note: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null };
}

const DECK_REQUEST_PREFIX = "Deck request:";
const DECK_IMPORT_PREFIX = "from deck import:";
const CARD_REQUEST_NOTE = "Card request";

function isDeckRelated(item: RequestItem): boolean {
  return (
    item.note?.startsWith(DECK_REQUEST_PREFIX) ||
    item.note?.startsWith(DECK_IMPORT_PREFIX) ||
    false
  );
}

export default function AdminRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [catalog, setCatalog] = useState<Map<string, Card>>(new Map());
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/wishlist")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => setCatalog(new Map((data.cards ?? []).map((c: Card) => [c.id, c]))));
  }, []);

  async function markFulfilled(id: string) {
    await fetch(`/api/admin/wishlist/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function stockBadge(item: RequestItem) {
    if (!item.cardId) return null;
    const card = catalog.get(item.cardId);
    if (!card) return null;
    return card.stock > 0 ? (
      <span className="ml-2 text-xs text-green-400">In stock</span>
    ) : (
      <span className="ml-2 text-xs text-red-400">Out of stock</span>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  const wishlistItems = items.filter((i) => i.note !== CARD_REQUEST_NOTE && !isDeckRelated(i));
  const cardRequests = items.filter((i) => i.note === CARD_REQUEST_NOTE);
  const deckRequests = items.filter(isDeckRelated);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Requests</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Wishlist ({wishlistItems.length})
        </h2>
        {wishlistItems.length === 0 ? (
          <p className="text-sm text-zinc-500">None.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {wishlistItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="text-zinc-100">{item.qty}x {item.cardName}</p>
                  <p className="text-xs text-zinc-500">{item.user.name ?? item.user.email}</p>
                </div>
                <button onClick={() => markFulfilled(item.id)} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-green-500 hover:text-green-400">
                  Mark fulfilled
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Card Requests ({cardRequests.length})
        </h2>
        {cardRequests.length === 0 ? (
          <p className="text-sm text-zinc-500">None.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {cardRequests.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="text-zinc-100">{item.qty}x {item.cardName}{stockBadge(item)}</p>
                  <p className="text-xs text-zinc-500">{item.user.name ?? item.user.email}</p>
                </div>
                <button onClick={() => markFulfilled(item.id)} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-green-500 hover:text-green-400">
                  Mark fulfilled
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Deck Requests ({deckRequests.length})
        </h2>
        {deckRequests.length === 0 ? (
          <p className="text-sm text-zinc-500">None.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {deckRequests.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="text-zinc-100">{item.qty}x {item.cardName}{stockBadge(item)}</p>
                  <p className="text-xs text-zinc-500">
                    {item.note?.replace(DECK_REQUEST_PREFIX, "").replace(DECK_IMPORT_PREFIX, "").trim()} · {item.user.name ?? item.user.email}
                  </p>
                </div>
                <button onClick={() => markFulfilled(item.id)} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-green-500 hover:text-green-400">
                  Mark fulfilled
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
