"use client";

import { useEffect, useState } from "react";

interface DiscountCode {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  maxRedemptions: number | null;
  timesRedeemed: number;
  createdAt: string;
}

function describe(c: DiscountCode): string {
  const off = c.percentOff != null ? `${c.percentOff}% off` : c.amountOff != null ? `$${(c.amountOff / 100).toFixed(2)} off` : "discount";
  return off;
}

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("10");
  const [limited, setLimited] = useState(true);
  const [maxUses, setMaxUses] = useState("100");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/discounts")
      .then((r) => r.json())
      .then((d) => { setCodes(d.codes ?? []); setLoading(false); });
  }
  useEffect(load, []);

  async function create() {
    setError(null);
    const num = Number(value);
    if (!code.trim()) { setError("Enter a code."); return; }
    if (!num || num <= 0) { setError("Enter a discount amount."); return; }
    setCreating(true);
    const res = await fetch("/api/admin/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        ...(kind === "percent" ? { percentOff: num } : { amountOffCents: Math.round(num * 100) }),
        ...(limited ? { maxRedemptions: Math.round(Number(maxUses) || 0) } : {}),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error ?? "Couldn't create code."); return; }
    setCodes((prev) => [data.code, ...prev]);
    setCode("");
  }

  async function toggle(c: DiscountCode) {
    setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/admin/discounts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
  }

  function copy(c: DiscountCode) {
    navigator.clipboard?.writeText(c.code);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Discount Codes</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Create codes to share with customers — they enter them at checkout in the “Add promotion code” box.
        Codes apply to a single order. Turn one off any time; a disabled code stops working immediately.
      </p>

      {/* Create form */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BADGY10"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Discount</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "percent" | "amount")}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="percent">% off</option>
                <option value="amount">$ off</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} className="h-4 w-4 accent-purple-500" />
            Limit total uses
          </label>
          {limited && (
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          )}
          <span className="text-xs text-zinc-500">{limited ? "redemptions, then it stops working" : "unlimited uses"}</span>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={create}
          disabled={creating}
          className="mt-4 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:bg-zinc-700"
        >
          {creating ? "Creating…" : "Create code"}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-zinc-500">No discount codes yet — create one above.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold text-zinc-100">{c.code}</span>
                  <button onClick={() => copy(c)} className="text-xs text-purple-400 hover:text-purple-300">
                    {copiedId === c.id ? "Copied!" : "Copy"}
                  </button>
                  {!c.active && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">Off</span>}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {describe(c)} · {c.maxRedemptions != null ? `${c.timesRedeemed}/${c.maxRedemptions} used` : `${c.timesRedeemed} used · unlimited`}
                </p>
              </div>
              <button
                onClick={() => toggle(c)}
                className={`rounded-lg border px-3 py-1 text-sm ${c.active ? "border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-400" : "border-zinc-700 text-zinc-300 hover:border-green-500 hover:text-green-400"}`}
              >
                {c.active ? "Disable" : "Enable"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
