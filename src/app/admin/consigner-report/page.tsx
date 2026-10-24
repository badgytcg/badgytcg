"use client";

import { useEffect, useState } from "react";

interface Consigner {
  slug: string;
  name: string;
}

interface SaleItem {
  id: string;
  cardId: string;
  cardName: string;
  qty: number;
  priceCents: number;
  owner: string;
  order: {
    createdAt: string;
    status: string;
    stripeSessionId: string;
    guestEmail: string | null;
  };
}

interface Expense {
  id: string;
  label: string;
  category: string;
  amountCents: number;
  note: string | null;
  spentAt: string;
}

const EXPENSE_CATEGORIES = [
  { value: "cards", label: "Cards" },
  { value: "supplies", label: "Supplies" },
  { value: "shipping", label: "Shipping materials" },
  { value: "fees", label: "Fees" },
  { value: "other", label: "Other" },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

export default function ConsignerReportPage() {
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [owner, setOwner] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Shop costs / profit ledger
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [grossSalesCents, setGrossSalesCents] = useState(0);
  const [totalCostCents, setTotalCostCents] = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [expLabel, setExpLabel] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("cards");
  const [expDate, setExpDate] = useState("");
  const [expError, setExpError] = useState<string | null>(null);
  const [savingExp, setSavingExp] = useState(false);

  useEffect(() => {
    fetch("/api/admin/consigners").then((r) => r.json()).then((d) => setConsigners(d.consigners ?? []));
    loadExpenses();
  }, []);

  // Default the report to all-time on first load so sales show immediately.
  useEffect(() => { runReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function loadExpenses() {
    fetch("/api/admin/expenses").then((r) => r.json()).then((d) => {
      setExpenses(d.expenses ?? []);
      setGrossSalesCents(d.grossSalesCents ?? 0);
      setTotalCostCents(d.totalCostCents ?? 0);
      setByCategory(d.byCategory ?? {});
    });
  }

  async function addExpense() {
    setExpError(null);
    const amount = Number(expAmount);
    if (!expLabel.trim()) { setExpError("Add a label for what you bought."); return; }
    if (!amount || amount <= 0) { setExpError("Enter an amount greater than $0."); return; }
    setSavingExp(true);
    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: expLabel.trim(), amount, category: expCategory, ...(expDate ? { spentAt: expDate } : {}) }),
    });
    setSavingExp(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setExpError(d.error ?? "Couldn't save."); return; }
    setExpLabel(""); setExpAmount(""); setExpDate("");
    loadExpenses();
  }

  async function removeExpense(id: string) {
    if (!confirm("Remove this cost entry?")) return;
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    loadExpenses();
  }

  // Local YYYY-MM-DD (not UTC) so "Today" matches the admin's calendar day.
  const fmt = (d: Date) => {
    const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return tz.toISOString().slice(0, 10);
  };
  function setToday() { const t = fmt(new Date()); setFrom(t); setTo(t); }
  function setLastDays(n: number) { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - (n - 1)); setFrom(fmt(s)); setTo(fmt(e)); }
  function setThisMonth() { const now = new Date(); setFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(fmt(now)); }
  function setThisYear() { const now = new Date(); setFrom(fmt(new Date(now.getFullYear(), 0, 1))); setTo(fmt(now)); }
  function setAllTime() { setFrom(""); setTo(""); }
  const PRESETS: { label: string; fn: () => void }[] = [
    { label: "Today", fn: setToday },
    { label: "Last 7 days", fn: () => setLastDays(7) },
    { label: "Last 30 days", fn: () => setLastDays(30) },
    { label: "This month", fn: setThisMonth },
    { label: "This year", fn: setThisYear },
    { label: "All time", fn: setAllTime },
  ];

  async function runReport() {
    const params = new URLSearchParams();
    if (owner !== "all") params.set("owner", owner);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const data = await fetch(`/api/admin/consigner-report?${params}`).then((r) => r.json());
    setItems(data.items ?? []);
    setTotalCents(data.totalCents ?? 0);
    setLoaded(true);
  }

  function exportCsv() {
    const ownerName = consigners.find((c) => c.slug === owner)?.name ?? owner;
    const header = ["Date", "Order ID", "Card", "Qty", "Unit Price", "Line Total", "Owner", "Status", "Buyer Email"];
    const rows = items.map((i) => [
      new Date(i.order.createdAt).toLocaleDateString(),
      i.order.stripeSessionId,
      i.cardName,
      i.qty,
      `$${(i.priceCents / 100).toFixed(2)}`,
      `$${((i.priceCents * i.qty) / 100).toFixed(2)}`,
      ownerName,
      i.order.status,
      i.order.guestEmail ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateRange = from || to ? `_${from || "start"}_to_${to || "now"}` : "";
    a.download = `consigner_report_${owner}${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-100">Sales Report</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Itemized breakdown of what sold by consigner — use this to pay out cosigners and for tax records.
      </p>

      {/* Shop P&L — all-time money in vs. money out */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Costs &amp; Profit (all time)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-950 p-4">
            <p className="text-xs text-zinc-500">Gross sales</p>
            <p className="text-xl font-bold text-green-400">${(grossSalesCents / 100).toFixed(2)}</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">all completed orders</p>
          </div>
          <div className="rounded-lg bg-zinc-950 p-4">
            <p className="text-xs text-zinc-500">Total costs</p>
            <p className="text-xl font-bold text-red-400">− ${(totalCostCents / 100).toFixed(2)}</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">{expenses.length} entr{expenses.length === 1 ? "y" : "ies"}</p>
          </div>
          <div className="rounded-lg bg-zinc-950 p-4">
            <p className="text-xs text-zinc-500">Net {grossSalesCents - totalCostCents >= 0 ? "profit" : "loss"}</p>
            <p className={`text-xl font-bold ${grossSalesCents - totalCostCents >= 0 ? "text-green-400" : "text-amber-400"}`}>
              {grossSalesCents - totalCostCents < 0 ? "− " : ""}${(Math.abs(grossSalesCents - totalCostCents) / 100).toFixed(2)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600">sales − costs</p>
          </div>
        </div>

        {Object.keys(byCategory).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {EXPENSE_CATEGORIES.filter((c) => byCategory[c.value]).map((c) => (
              <span key={c.value}>{c.label}: <span className="text-zinc-300">${((byCategory[c.value] ?? 0) / 100).toFixed(2)}</span></span>
            ))}
          </div>
        )}

        {/* Add a cost */}
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs text-zinc-500">What you bought</label>
            <input
              value={expLabel}
              onChange={(e) => setExpLabel(e.target.value)}
              placeholder="e.g. Enter the Huddle booster case"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Category</label>
            <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Amount</label>
            <input
              type="number" step="0.01" min={0}
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="0.00"
              className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Date</label>
            <input
              type="date" value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <button onClick={addExpense} disabled={savingExp} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700">
            {savingExp ? "Adding…" : "Add cost"}
          </button>
        </div>
        {expError && <p className="mt-2 text-sm text-red-400">{expError}</p>}

        {/* Running cost ledger */}
        {expenses.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Running total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(() => {
                  // Oldest → newest to show a sensible running total, then display newest first.
                  const asc = [...expenses].sort((a, b) => new Date(a.spentAt).getTime() - new Date(b.spentAt).getTime());
                  let running = 0;
                  const withRunning = asc.map((e) => { running += e.amountCents; return { e, running }; });
                  return withRunning.slice().reverse().map(({ e, running }) => (
                    <tr key={e.id} className="bg-zinc-900">
                      <td className="px-3 py-2 text-zinc-400">{new Date(e.spentAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-zinc-200">{e.label}</td>
                      <td className="px-3 py-2 text-zinc-500">{CATEGORY_LABEL[e.category] ?? e.category}</td>
                      <td className="px-3 py-2 text-right text-red-400">${(e.amountCents / 100).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-zinc-400">${(running / 100).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeExpense(e.id)} className="text-xs text-zinc-600 hover:text-red-400">Remove</button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Consigner</label>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="all">All consigners</option>
            {consigners.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">From</label>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">To</label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            <button
              onClick={() => setTo(fmt(new Date()))}
              title="Set end date to today"
              className="rounded-lg border border-zinc-700 px-2 py-2 text-xs text-zinc-300 hover:border-purple-500 hover:text-purple-300"
            >
              Today
            </button>
          </div>
        </div>
        <button
          onClick={runReport}
          className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
        >
          Run Report
        </button>
        {loaded && items.length > 0 && (
          <button
            onClick={exportCsv}
            className="rounded-lg border border-zinc-600 px-5 py-2 text-sm font-medium text-zinc-200 hover:border-purple-500 hover:text-purple-300"
          >
            Export CSV
          </button>
        )}
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <span className="text-xs text-zinc-500">Quick range:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={p.fn}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-purple-500 hover:text-purple-300"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loaded && (
        <>
          <div className="mb-4 flex items-center gap-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
              <p className="text-xs text-zinc-500">Total Sales</p>
              <p className="text-xl font-bold text-green-400">${(totalCents / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
              <p className="text-xs text-zinc-500">Line Items</p>
              <p className="text-xl font-bold text-zinc-100">{items.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
              <p className="text-xs text-zinc-500">Units Sold</p>
              <p className="text-xl font-bold text-zinc-100">{items.reduce((s, i) => s + i.qty, 0)}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">No sales found for this filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Card</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Unit Price</th>
                    <th className="px-4 py-2">Line Total</th>
                    <th className="px-4 py-2">Owner</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const ownerName = consigners.find((c) => c.slug === item.owner)?.name ?? item.owner;
                    return (
                      <tr key={item.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-2 text-zinc-400">{new Date(item.order.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2 font-medium text-zinc-100">{item.cardName}</td>
                        <td className="px-4 py-2 text-zinc-300">{item.qty}</td>
                        <td className="px-4 py-2 text-zinc-300">${(item.priceCents / 100).toFixed(2)}</td>
                        <td className="px-4 py-2 font-medium text-green-400">
                          ${((item.priceCents * item.qty) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300">
                            {ownerName}
                          </span>
                        </td>
                        <td className="px-4 py-2 capitalize text-zinc-400">{item.order.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
