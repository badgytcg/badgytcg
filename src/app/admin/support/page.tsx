"use client";

import { useEffect, useState } from "react";

interface Msg {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  orderRef: string | null;
  handled: boolean;
  createdAt: string;
}

export default function AdminSupportPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHandled, setShowHandled] = useState(false);

  function load() {
    fetch("/api/admin/contact")
      .then((r) => r.json())
      .then((d) => { setMessages(d.messages ?? []); setLoading(false); });
  }
  useEffect(load, []);

  async function setHandled(id: string, handled: boolean) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, handled } : m)));
    await fetch(`/api/admin/contact/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handled }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/admin/contact/${id}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">Loading…</div>;

  const shown = messages.filter((m) => showHandled || !m.handled);
  const openCount = messages.filter((m) => !m.handled).length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Support Messages</h1>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} className="h-4 w-4 accent-purple-500" />
          Show handled
        </label>
      </div>
      <p className="mb-6 text-sm text-zinc-400">
        Messages from the customer contact form. {openCount} open. Replies also land in your email —
        just reply there to answer the customer directly.
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">No messages{showHandled ? "" : " to handle"}.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => (
            <li key={m.id} className={`rounded-xl border p-4 ${m.handled ? "border-zinc-800 bg-zinc-900/40 opacity-70" : "border-zinc-700 bg-zinc-900"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-100">{m.subject}</p>
                  <p className="text-xs text-zinc-500">
                    {m.name} ·{" "}
                    <a href={`mailto:${m.email}`} className="text-purple-400 hover:underline">{m.email}</a>
                    {m.orderRef && <> · order {m.orderRef}</>} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}
                    className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                  >
                    Reply
                  </a>
                  <button
                    onClick={() => setHandled(m.id, !m.handled)}
                    className={`rounded-lg border px-3 py-1 text-xs ${m.handled ? "border-zinc-700 text-zinc-400 hover:border-yellow-500 hover:text-yellow-400" : "border-zinc-700 text-zinc-300 hover:border-green-500 hover:text-green-400"}`}
                  >
                    {m.handled ? "Reopen" : "Mark handled"}
                  </button>
                  <button onClick={() => remove(m.id)} className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-500 hover:border-red-800 hover:text-red-400">
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
