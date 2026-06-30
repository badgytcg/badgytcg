"use client";

import { useEffect, useState } from "react";

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
}

const STATUSES = ["pending", "paid", "fulfilled", "cancelled"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

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
    try {
      const res = await fetch(`/api/admin/orders/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendResult(data.error ?? "Couldn't send.");
      } else {
        setSendResult(`Sent to ${data.to}.`);
      }
    } catch {
      setSendResult("Couldn't reach the server. Try again.");
    }
    setSending(false);
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
        <ul className="space-y-4">
          {orders.map((order) => {
            const email = emailFor(order);
            const messaging = messagingId === order.id;
            return (
              <li key={order.id} className="rounded-xl border border-zinc-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-zinc-200">{order.user?.name ?? email ?? "Guest"}</p>
                    <p className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()}</p>
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
                  </div>
                </div>
                <ul className="mt-3 text-xs text-zinc-500">
                  {order.items.map((item) => (
                    <li key={item.id}>{item.qty}x {item.cardName} — ${(item.priceCents / 100).toFixed(2)} ea</li>
                  ))}
                </ul>

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
}
