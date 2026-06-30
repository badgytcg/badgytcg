"use client";

import { useEffect, useState } from "react";

interface Consigner {
  slug: string;
  name: string;
  email: string | null;
}

const BLANK = { slug: "", name: "", email: "" };

export default function ConsignersPage() {
  const [list, setList] = useState<Consigner[]>([]);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/admin/consigners").then((r) => r.json()).then((d) => setList(d.consigners ?? []));
  }
  useEffect(load, []);

  async function save() {
    setSaving(true);
    await fetch("/api/admin/consigners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(BLANK);
    setSaving(false);
    load();
  }

  async function remove(slug: string) {
    await fetch("/api/admin/consigners", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-100">Consigners</h1>
      <p className="mb-6 text-sm text-zinc-400">
        People whose cards are sold through the shop. The slug is used internally to tag inventory — keep it short and lowercase (e.g. &quot;sneakerdad&quot;).
      </p>

      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add / Update Consigner</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Slug (e.g. sneakerdad)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            placeholder="Display name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || !form.slug || !form.name}
          className="mt-3 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
        >
          {saving ? "Saving..." : "Save Consigner"}
        </button>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Active Consigners</h2>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.slug} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div>
              <p className="font-medium text-zinc-100">{c.name}</p>
              <p className="text-xs text-zinc-500">
                slug: <span className="font-mono text-purple-400">{c.slug}</span>
                {c.email && ` · ${c.email}`}
              </p>
            </div>
            {c.slug !== "badgy" && (
              <button
                onClick={() => remove(c.slug)}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400"
              >
                Remove
              </button>
            )}
            {c.slug === "badgy" && (
              <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300">Primary owner</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
