"use client";

import { useEffect, useState } from "react";

export default function AdminShippingNoticePage() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [resumeDate, setResumeDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/shipping-notice")
      .then((r) => r.json())
      .then((d) => {
        setActive(!!d.active);
        setMessage(d.message ?? "");
        setResumeDate(d.resumeDate ?? "");
        setLoading(false);
      });
  }, []);

  async function save(nextActive = active) {
    setError(null);
    setResult(null);
    if (nextActive && !message.trim()) { setError("Add a message buyers will see before turning it on."); return; }
    setSaving(true);
    const res = await fetch("/api/admin/shipping-notice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive, message: message.trim(), resumeDate: resumeDate || null }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Couldn't save."); return; }
    const d = await res.json();
    setActive(d.active);
    setResult(d.active ? "Notice is ON — buyers now see the banner." : "Notice is OFF.");
  }

  if (loading) return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">Loading…</div>;

  const resumePretty = resumeDate ? new Date(resumeDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Shipping Notice</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Turn this on when shipping will be delayed (e.g. you&apos;re out of town). Buyers see a banner across
        the site, and it&apos;s added to their order confirmation email so they know before they buy.
      </p>

      <div className={`mb-6 rounded-xl border p-5 ${active ? "border-amber-700/60 bg-amber-950/30" : "border-zinc-800 bg-zinc-900"}`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-zinc-100">Status</p>
            <p className="text-sm text-zinc-500">{active ? "ON — the delay banner is showing to buyers." : "OFF — normal shipping."}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-amber-900/50 text-amber-300 ring-1 ring-amber-700/50" : "bg-zinc-800 text-zinc-400"}`}>
            {active ? "Active" : "Off"}
          </span>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-400">Message buyers see</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Heads up — I'm away until early next week, so orders placed now will ship a few days late. Thanks for your patience! 🐧"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-600"
        />

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-zinc-400">Shipping resumes (optional)</label>
          <input
            type="date"
            value={resumeDate}
            onChange={(e) => setResumeDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          {resumePretty && <p className="mt-1 text-xs text-zinc-500">Buyers will see: &quot;Orders ship again around {resumePretty}.&quot;</p>}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {result && <p className="mt-3 text-sm text-green-400">{result}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {active ? (
            <>
              <button onClick={() => save(true)} disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700">
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button onClick={() => save(false)} disabled={saving} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400">
                Turn off
              </button>
            </>
          ) : (
            <button onClick={() => save(true)} disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:bg-zinc-700">
              {saving ? "Saving…" : "Turn on delay notice"}
            </button>
          )}
        </div>
      </div>

      {/* Live preview of the banner */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</p>
      <div className="rounded-lg border border-amber-700/50 bg-amber-950/60 px-4 py-2.5 text-center text-sm text-amber-200">
        <span className="mr-1">🚚</span>
        <span className="font-medium">{message.trim() || "Shipping is temporarily delayed."}</span>
        {resumePretty && <span className="text-amber-300/80"> Orders ship again around {resumePretty}.</span>}
      </div>
    </div>
  );
}
