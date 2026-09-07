"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/lib/types";

interface Customer { id: string; name: string | null; email: string | null; }
interface BillItem { id: string; cardId: string; cardName: string; qty: number; priceCents: number; }
interface Bill {
  id: string; status: string; note: string | null; totalCents: number; createdAt: string;
  items: BillItem[]; user: { name: string | null; email: string | null };
}
interface DraftLine { cardId: string; name: string; price: number; qty: number; }

export default function AdminBillsPage() {
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function loadBills() {
    fetch("/api/admin/bills").then((r) => r.json()).then((d) => {
      setBills(d.bills ?? []);
      setCustomers(d.customers ?? []);
      setLoading(false);
    });
  }
  useEffect(() => {
    loadBills();
    fetch("/api/cards").then((r) => r.json()).then((d) => setCatalog(d.cards ?? []));
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalog, query]);

  function addLine(card: Card) {
    setDraft((prev) => {
      const ex = prev.find((l) => l.cardId === card.id);
      if (ex) return prev.map((l) => (l.cardId === card.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { cardId: card.id, name: card.name, price: card.price, qty: 1 }];
    });
    setQuery("");
  }
  function setQty(cardId: string, qty: number) {
    setDraft((prev) => (qty <= 0 ? prev.filter((l) => l.cardId !== cardId) : prev.map((l) => (l.cardId === cardId ? { ...l, qty } : l))));
  }

  const draftTotal = draft.reduce((s, l) => s + l.price * l.qty, 0);

  async function createBill() {
    if (!userId || draft.length === 0) return;
    setCreating(true);
    setResult(null);
    const res = await fetch("/api/admin/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, note: note || null, items: draft.map((l) => ({ cardId: l.cardId, qty: l.qty })) }),
    });
    if (res.ok) {
      setResult("Bill created and emailed to the customer.");
      setDraft([]); setNote(""); setUserId("");
      loadBills();
    } else {
      const d = await res.json();
      setResult(d.error ?? "Couldn't create bill.");
    }
    setCreating(false);
  }

  async function cancelBill(id: string) {
    if (!confirm("Cancel this bill?")) return;
    await fetch(`/api/admin/bills/${id}`, { method: "DELETE" });
    loadBills();
  }

  if (loading) return <div className="mx-auto max-w-4xl px-6 py-16 text-center text-zinc-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-100">Private Bills</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Put together cards a customer requested and bill them privately. They pay through Stripe or add it to their cart from their account page. Prices use the current store price.
      </p>

      {/* Create */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">New Bill</h2>

        <label className="mb-1 block text-xs text-zinc-500">Customer</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
          <option value="">Select a customer…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.email}{c.name ? ` (${c.name})` : ""}</option>)}
        </select>
        {customers.length === 0 && (
          <p className="mb-4 text-xs text-yellow-500">No customer accounts yet — a customer must sign in once before you can bill them.</p>
        )}

        <label className="mb-1 block text-xs text-zinc-500">Add cards</label>
        <div className="relative">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search card name…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button onClick={() => addLine(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                    <span>{c.name} <span className="text-xs text-zinc-500">· {c.set}</span></span>
                    <span className="text-purple-300">${c.price.toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {draft.length > 0 && (
          <div className="mt-4 space-y-2">
            {draft.map((l) => (
              <div key={l.cardId} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-zinc-200">{l.name}</span>
                <span className="text-zinc-500">${l.price.toFixed(2)}</span>
                <input type="number" min={0} value={l.qty} onChange={(e) => setQty(l.cardId, Number(e.target.value))}
                  className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100" />
                <span className="w-16 text-right text-zinc-300">${(l.price * l.qty).toFixed(2)}</span>
                <button onClick={() => setQty(l.cardId, 0)} className="text-zinc-600 hover:text-red-400">✕</button>
              </div>
            ))}
            <div className="flex justify-end border-t border-zinc-800 pt-2 text-sm font-semibold text-zinc-100">
              Total: ${draftTotal.toFixed(2)} <span className="ml-1 text-xs font-normal text-zinc-500">+ shipping at checkout</span>
            </div>
          </div>
        )}

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to customer (optional)"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />

        <button onClick={createBill} disabled={creating || !userId || draft.length === 0}
          className="mt-4 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-400">
          {creating ? "Creating…" : "Create & Send Bill"}
        </button>
        {result && <p className="mt-3 text-sm text-zinc-400">{result}</p>}
      </div>

      {/* Existing */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">All Bills ({bills.length})</h2>
      {bills.length === 0 ? (
        <p className="text-sm text-zinc-500">No bills yet.</p>
      ) : (
        <ul className="space-y-3">
          {bills.map((b) => (
            <li key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-zinc-100">{b.user.email}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === "paid" ? "bg-green-900/50 text-green-300" : b.status === "cancelled" ? "bg-zinc-800 text-zinc-500" : "bg-yellow-900/40 text-yellow-300"}`}>
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-purple-300">${(b.totalCents / 100).toFixed(2)}</span>
                  {b.status === "open" && (
                    <button onClick={() => cancelBill(b.id)} className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:border-red-500 hover:text-red-400">Cancel</button>
                  )}
                </div>
              </div>
              <ul className="mt-2 text-xs text-zinc-500">
                {b.items.map((i) => <li key={i.id}>{i.qty}x {i.cardName} — ${(i.priceCents / 100).toFixed(2)} ea</li>)}
              </ul>
              {b.note && <p className="mt-1 text-xs text-zinc-600">Note: {b.note}</p>}
              <p className="mt-1 text-[11px] text-zinc-600">{new Date(b.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
