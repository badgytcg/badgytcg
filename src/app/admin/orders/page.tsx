"use client";

import { useEffect, useState } from "react";
import { CARRIERS, trackingUrl } from "@/lib/tracking";

interface OrderItem {
  id: string;
  cardName: string;
  qty: number;
  priceCents: number;
}

interface AdminOrder {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  guestEmail: string | null;
  items: OrderItem[];
  user: { name: string | null; email: string | null } | null;
  shipName: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostal: string | null;
  shipCountry: string | null;
  shipPhone: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
}

const STATUSES = ["pending", "paid", "fulfilled", "cancelled", "refunded"];

interface OrderGroup {
  key: string;
  label: string;
  email: string | null;
  orders: AdminOrder[];
  totalCents: number;
}

// Group orders by customer (account email, else guest email). Orders arrive
// newest-first, so each group's first order is its most recent.
function groupOrders(orders: AdminOrder[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>();
  for (const o of orders) {
    const email = o.user?.email ?? o.guestEmail ?? null;
    const key = email ?? `guest:${o.id}`;
    if (!map.has(key)) {
      map.set(key, { key, label: o.user?.name ?? email ?? "Guest (no account)", email, orders: [], totalCents: 0 });
    }
    const g = map.get(key)!;
    g.orders.push(o);
    g.totalCents += o.totalCents;
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.orders[0].createdAt).getTime() - new Date(a.orders[0].createdAt).getTime()
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundMsg, setRefundMsg] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Draft tracking edits per order: { number, carrier }
  const [trackDraft, setTrackDraft] = useState<Record<string, { number: string; carrier: string }>>({});
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);
  const [trackErr, setTrackErr] = useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function trackFields(order: AdminOrder) {
    return trackDraft[order.id] ?? { number: order.trackingNumber ?? "", carrier: order.trackingCarrier ?? "usps" };
  }
  function setTrackField(id: string, field: "number" | "carrier", value: string) {
    setTrackDraft((prev) => ({ ...prev, [id]: { ...trackFields(orders.find((o) => o.id === id)!), [field]: value } }));
  }

  async function saveTracking(order: AdminOrder) {
    const { number, carrier } = trackFields(order);
    setSavingTrackId(order.id);
    setTrackErr((p) => ({ ...p, [order.id]: "" }));
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber: number.trim() || null, trackingCarrier: carrier }),
    });
    if (res.ok) {
      const gotTracking = !!number.trim();
      setOrders((prev) => prev.map((o) => o.id === order.id
        ? { ...o, trackingNumber: number.trim() || null, trackingCarrier: gotTracking ? carrier : null, status: gotTracking && o.status === "paid" ? "fulfilled" : o.status }
        : o));
      setTrackDraft((prev) => { const n = { ...prev }; delete n[order.id]; return n; });
    } else {
      const data = await res.json().catch(() => ({}));
      setTrackErr((p) => ({ ...p, [order.id]: data.error ?? "Couldn't save tracking." }));
    }
    setSavingTrackId(null);
  }

  function copyAddress(order: AdminOrder) {
    const lines = [
      order.shipName,
      order.shipLine1,
      order.shipLine2,
      `${order.shipCity ?? ""}, ${order.shipState ?? ""} ${order.shipPostal ?? ""}`.trim(),
      order.shipCountry && order.shipCountry !== "US" ? order.shipCountry : null,
      order.shipPhone,
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join("\n"));
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function refundOrder(order: AdminOrder) {
    if (!confirm(`Refund $${(order.totalCents / 100).toFixed(2)} to the customer through Stripe? This can't be undone.`)) return;
    setRefundingId(order.id);
    setRefundMsg((p) => ({ ...p, [order.id]: "" }));
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "refunded" } : o)));
        setRefundMsg((p) => ({ ...p, [order.id]: `✓ Refunded $${(order.totalCents / 100).toFixed(2)} — Stripe is returning it to the customer.` }));
      } else {
        setRefundMsg((p) => ({ ...p, [order.id]: `✗ ${data.error ?? "Refund failed."}` }));
      }
    } catch {
      setRefundMsg((p) => ({ ...p, [order.id]: "✗ Couldn't reach the server. Try again." }));
    }
    setRefundingId(null);
  }

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders ?? []);
        setLoading(false);
      });
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  function emailFor(order: AdminOrder): string | null {
    return order.user?.email ?? order.guestEmail;
  }

  function openMessage(order: AdminOrder) {
    setMessagingId(order.id);
    setSubject(`About your BadgyTCG order (#${order.id.slice(-6)})`);
    setMessage("");
    setSendResult(null);
  }

  async function sendMessage(id: string) {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setSendResult(null);
    // Safety net: never let the button hang forever if the server stalls.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`/api/admin/orders/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setSendResult(data.error ?? "Couldn't send.");
      } else {
        setSendResult(`Sent to ${data.to}.`);
      }
    } catch (err) {
      setSendResult(
        err instanceof DOMException && err.name === "AbortError"
          ? "Timed out waiting for Gmail. Try again — if it keeps timing out, the mail server may be unreachable."
          : "Couldn't reach the server. Try again."
      );
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Orders</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No orders yet — this fills up once checkout is built and customers start paying.
        </p>
      ) : (
        <div className="space-y-4">
          {groupOrders(orders).map((group) => {
            const open = openGroups.has(group.key);
            return (
            <div key={group.key} className="overflow-hidden rounded-xl border border-zinc-800">
              <button
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center justify-between gap-3 bg-zinc-900 px-4 py-3 text-left hover:bg-zinc-800/60"
              >
                <div>
                  <p className="font-medium text-zinc-100">{group.label}</p>
                  <p className="text-xs text-zinc-500">
                    {group.email ?? "guest checkout"} · {group.orders.length} order{group.orders.length > 1 ? "s" : ""} · ${(group.totalCents / 100).toFixed(2)} total
                  </p>
                </div>
                <span className="text-lg text-zinc-400">{open ? "▾" : "▸"}</span>
              </button>
              {open && (
              <ul className="divide-y divide-zinc-800 border-t border-zinc-800">
          {group.orders.map((order) => {
            const email = emailFor(order);
            const messaging = messagingId === order.id;
            return (
              <li key={order.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()} · #{order.id.slice(-6)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-purple-300">${(order.totalCents / 100).toFixed(2)}</span>
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => (messaging ? setMessagingId(null) : openMessage(order))}
                      disabled={!email}
                      title={email ? "Email this customer" : "No email on file for this order"}
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-purple-500 hover:text-purple-300 disabled:opacity-40"
                    >
                      Message
                    </button>
                    <a
                      href={`/admin/orders/${order.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Printable packing slip / receipt"
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                    >
                      Receipt
                    </a>
                    {(order.status === "paid" || order.status === "fulfilled") && (
                      <button
                        onClick={() => refundOrder(order)}
                        disabled={refundingId === order.id}
                        title="Refund this payment through Stripe"
                        className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400 disabled:opacity-40"
                      >
                        {refundingId === order.id ? "Refunding…" : "Refund"}
                      </button>
                    )}
                  </div>
                </div>
                <ul className="mt-3 text-xs text-zinc-500">
                  {order.items.map((item) => (
                    <li key={item.id}>{item.qty}x {item.cardName} — ${(item.priceCents / 100).toFixed(2)} ea</li>
                  ))}
                </ul>

                {order.shipLine1 ? (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ship to</p>
                      <button
                        onClick={() => copyAddress(order)}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        {copiedId === order.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-zinc-200">{order.shipName}</p>
                    <p className="text-sm text-zinc-400">{order.shipLine1}</p>
                    {order.shipLine2 && <p className="text-sm text-zinc-400">{order.shipLine2}</p>}
                    <p className="text-sm text-zinc-400">
                      {order.shipCity}, {order.shipState} {order.shipPostal}
                      {order.shipCountry && order.shipCountry !== "US" ? ` · ${order.shipCountry}` : ""}
                    </p>
                    {order.shipPhone && <p className="text-sm text-zinc-500">{order.shipPhone}</p>}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-600">
                    No address stored — check this order in your Stripe dashboard, or it predates address capture.
                  </p>
                )}

                {order.status !== "cancelled" && order.status !== "refunded" && (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Tracking</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={trackFields(order).number}
                        onChange={(e) => setTrackField(order.id, "number", e.target.value)}
                        placeholder="Tracking number"
                        className="flex-1 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600"
                      />
                      <select
                        value={trackFields(order).carrier}
                        onChange={(e) => setTrackField(order.id, "carrier", e.target.value)}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                      >
                        {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <button
                        onClick={() => saveTracking(order)}
                        disabled={savingTrackId === order.id}
                        className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
                      >
                        {savingTrackId === order.id ? "Saving…" : "Save tracking"}
                      </button>
                    </div>
                    {trackErr[order.id] && <p className="mt-2 text-sm text-red-400">{trackErr[order.id]}</p>}
                    {order.trackingNumber && (
                      <p className="mt-2 text-sm text-zinc-400">
                        Saved:{" "}
                        {trackingUrl(order.trackingCarrier, order.trackingNumber) ? (
                          <a href={trackingUrl(order.trackingCarrier, order.trackingNumber)!} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                            {order.trackingNumber}
                          </a>
                        ) : (
                          <span className="text-zinc-300">{order.trackingNumber}</span>
                        )}
                        {" "}— the customer can see &amp; track this on their account.
                      </p>
                    )}
                  </div>
                )}

                {refundMsg[order.id] && (
                  <p className={`mt-2 text-sm ${refundMsg[order.id].startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                    {refundMsg[order.id]}
                  </p>
                )}

                {messaging && (
                  <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <p className="mb-2 text-xs text-zinc-500">To: {email}</p>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject"
                      className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    />
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your message..."
                      rows={5}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => sendMessage(order.id)}
                        disabled={sending || !subject.trim() || !message.trim()}
                        className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
                      >
                        {sending ? "Sending..." : "Send Email"}
                      </button>
                      <button
                        onClick={() => setMessagingId(null)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
                      >
                        Cancel
                      </button>
                      {sendResult && <span className="text-xs text-zinc-400">{sendResult}</span>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
              </ul>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
