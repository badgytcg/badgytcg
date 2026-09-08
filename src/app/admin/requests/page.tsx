"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/lib/types";

interface RequestItem {
  id: string;
  userId: string;
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
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [catalog, setCatalog] = useState<Map<string, Card>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [billingUser, setBillingUser] = useState<string | null>(null);
  const [billResult, setBillResult] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/wishlist")
      .then((res) => res.json())
      .then((data) => {
        const list: RequestItem[] = data.items ?? [];
        setItems(list);
        // Default: every billable item checked, so "Bill selected" = bill all.
        setChecked(new Set(list.filter((i) => i.cardId).map((i) => i.id)));
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

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  // Group everything billable (has a cardId that's in the catalog) by customer.
  const billableByCustomer = useMemo(() => {
    const groups = new Map<string, { userId: string; label: string; items: RequestItem[] }>();
    for (const it of items) {
      if (!it.cardId || !catalog.has(it.cardId)) continue;
      const key = it.userId;
      if (!groups.has(key)) {
        groups.set(key, { userId: it.userId, label: it.user.name ?? it.user.email ?? "Customer", items: [] });
      }
      groups.get(key)!.items.push(it);
    }
    return [...groups.values()];
  }, [items, catalog]);

  // Collapse a customer's checked requests into {cardId, qty} bill lines,
  // summing duplicates of the same card.
  function selectedLines(group: { items: RequestItem[] }) {
    const byCard = new Map<string, number>();
    for (const it of group.items) {
      if (!it.cardId || !checked.has(it.id)) continue;
      byCard.set(it.cardId, (byCard.get(it.cardId) ?? 0) + it.qty);
    }
    return [...byCard.entries()].map(([cardId, qty]) => ({ cardId, qty }));
  }

  function selectedTotal(group: { items: RequestItem[] }) {
    return selectedLines(group).reduce((sum, l) => {
      const card = catalog.get(l.cardId);
      return sum + (card ? card.price * l.qty : 0);
    }, 0);
  }

  async function billSelected(group: { userId: string; label: string; items: RequestItem[] }) {
    const lines = selectedLines(group);
    if (lines.length === 0) return;
    setBillingUser(group.userId);
    setBillResult(null);
    const res = await fetch("/api/admin/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: group.userId, items: lines }),
    });
    if (res.ok) {
      // Clear the billed requests off the board.
      const billedIds = group.items.filter((i) => i.cardId && checked.has(i.id)).map((i) => i.id);
      await Promise.all(billedIds.map((id) => fetch(`/api/admin/wishlist/${id}`, { method: "DELETE" })));
      setItems((prev) => prev.filter((i) => !billedIds.includes(i.id)));
      setBillResult(`Billed ${group.label} — bill sent to their account.`);
    } else {
      const d = await res.json();
      setBillResult(d.error ?? "Couldn't create bill.");
    }
    setBillingUser(null);
  }

  // Send the selection to the Bills tab prefilled, for when you want to tweak
  // it (add more cards, a note) before sending.
  function editInBillsTab(group: { userId: string; items: RequestItem[] }) {
    const lines = selectedLines(group);
    if (lines.length === 0) return;
    try {
      sessionStorage.setItem("bill-prefill", JSON.stringify({ userId: group.userId, items: lines }));
    } catch { /* ignore */ }
    router.push("/admin/bills");
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

      {/* Bill customers from their requests */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Bill a Customer ({billableByCustomer.length})
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Check the cards you have for a customer — all, some, or one — then bill them in one click. Prices use the current store price.
        </p>
        {billResult && <p className="mb-3 text-sm text-purple-300">{billResult}</p>}
        {billableByCustomer.length === 0 ? (
          <p className="text-sm text-zinc-500">No requested cards to bill yet.</p>
        ) : (
          <div className="space-y-4">
            {billableByCustomer.map((group) => {
              const lines = selectedLines(group);
              return (
                <div key={group.userId} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-zinc-100">{group.label}</span>
                    <span className="text-xs text-zinc-500">{group.items.length} requested</span>
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((it) => {
                      const card = catalog.get(it.cardId!);
                      return (
                        <li key={it.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked.has(it.id)} onChange={() => toggle(it.id)}
                            className="h-4 w-4 accent-purple-500" />
                          <span className="flex-1 text-zinc-200">{it.qty}x {it.cardName}{stockBadge(it)}</span>
                          <span className="text-zinc-500">${card ? (card.price * it.qty).toFixed(2) : "?"}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
                    <span className="text-sm font-semibold text-zinc-100">
                      {lines.length} card type(s) · ${selectedTotal(group).toFixed(2)}
                    </span>
                    <button
                      onClick={() => billSelected(group)}
                      disabled={lines.length === 0 || billingUser === group.userId}
                      className="ml-auto rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {billingUser === group.userId ? "Billing…" : "Bill selected"}
                    </button>
                    <button
                      onClick={() => editInBillsTab(group)}
                      disabled={lines.length === 0}
                      className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:border-purple-500 hover:text-purple-300 disabled:opacity-40"
                    >
                      Edit in Bills tab →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
