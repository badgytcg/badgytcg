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

export default function ConsignerReportPage() {
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [owner, setOwner] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/consigners").then((r) => r.json()).then((d) => setConsigners(d.consigners ?? []));
  }, []);

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
      <h1 className="mb-1 text-2xl font-bold text-zinc-100">Consigner Sales Report</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Itemized breakdown of what sold by consigner — use this to pay out cosigners and for tax records.
      </p>

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
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
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
