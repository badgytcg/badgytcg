"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  detail: string;
  refId: string | null;
  ip: string | null;
  createdAt: string;
}

interface ScanItem {
  id: string;
  cardName: string;
  kind: string;
  qty: number;
  newStock: number;
  set: string | null;
  cardNumber: string | null;
  color: string | null;
}

const COLOR_DOT: Record<string, string> = {
  Blue: "#3b82f6", Yellow: "#eab308", Purple: "#a855f7", Green: "#22c55e",
  Red: "#ef4444", Colorless: "#a1a1aa", Relic: "#d97706", Rod: "#06b6d4",
};
function ColorDot({ color }: { color: string | null }) {
  if (!color) return null;
  const stops = color.split(" ").filter(Boolean).map((p) => COLOR_DOT[p] ?? "#71717a");
  const bg = stops.length > 1 ? `linear-gradient(135deg, ${stops[0]} 0 50%, ${stops[1]} 50% 100%)` : stops[0];
  return <span title={color} className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/30" style={{ background: bg }} />;
}

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Cache of loaded scan sessions by refId: undefined = not loaded, null = error/empty.
  const [scans, setScans] = useState<Record<string, ScanItem[] | null>>({});

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      });
  }, []);

  async function toggle(entry: AuditEntry) {
    const refId = entry.refId!;
    const next = new Set(open);
    if (next.has(entry.id)) {
      next.delete(entry.id);
      setOpen(next);
      return;
    }
    next.add(entry.id);
    setOpen(next);
    if (scans[refId] === undefined) {
      try {
        const res = await fetch(`/api/admin/scan-sessions/${refId}`);
        const data = await res.json();
        setScans((p) => ({ ...p, [refId]: res.ok ? (data.items ?? []) : null }));
      } catch {
        setScans((p) => ({ ...p, [refId]: null }));
      }
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Admin Activity Log</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Every price/stock change, listing edit, order status change, and customer email sent from this admin
        panel — most recent 200. If something looks off, this is where to check.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No admin actions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {entries.map((e) => {
            const isScan = e.action === "inventory.scan_commit" && !!e.refId;
            const expanded = open.has(e.id);
            const items = e.refId ? scans[e.refId] : undefined;
            // Group loaded items by set (already sorted set → name by the API).
            const groups: { set: string; items: ScanItem[] }[] = [];
            if (items) {
              for (const item of items) {
                const set = item.set ?? "Other";
                const last = groups[groups.length - 1];
                if (last && last.set === set) last.items.push(item);
                else groups.push({ set, items: [item] });
              }
            }
            return (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-purple-300">{e.action}</span>
                  <span className="text-xs text-zinc-500">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{e.detail}</p>
                <p className="mt-1 text-xs text-zinc-600">{e.adminEmail}{e.ip ? ` · ${e.ip}` : ""}</p>

                {isScan && (
                  <button
                    onClick={() => toggle(e)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-purple-500 hover:text-purple-300"
                  >
                    <span>{expanded ? "▾" : "▸"}</span> {expanded ? "Hide cards scanned" : "View cards scanned"}
                  </button>
                )}

                {isScan && expanded && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
                    {items === undefined ? (
                      <p className="px-3 py-2 text-xs text-zinc-500">Loading cards…</p>
                    ) : items === null ? (
                      <p className="px-3 py-2 text-xs text-zinc-500">Couldn&apos;t load this session&apos;s cards.</p>
                    ) : items.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-500">No cards recorded for this session.</p>
                    ) : (
                      groups.map((g) => (
                        <div key={g.set}>
                          <div className="flex items-center justify-between bg-zinc-800/60 px-3 py-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">{g.set}</span>
                            <span className="text-[10px] text-zinc-500">{g.items.reduce((n, i) => n + i.qty, 0)} card(s)</span>
                          </div>
                          <ul className="divide-y divide-zinc-800/60">
                            {g.items.map((i) => (
                              <li key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                                <span className="w-9 shrink-0 text-right font-semibold text-purple-300">+{i.qty}</span>
                                <ColorDot color={i.color} />
                                <span className="flex-1 truncate text-zinc-200">
                                  {i.cardName}
                                  {i.kind !== "base" && (
                                    <span className="ml-1 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300">
                                      {i.kind === "foil" ? "Foil" : "Alt Foil"}
                                    </span>
                                  )}
                                </span>
                                {i.cardNumber && <span className="shrink-0 font-mono text-xs text-zinc-500">#{i.cardNumber}</span>}
                                <span className="w-20 shrink-0 text-right text-xs text-zinc-500">→ {i.newStock} in stock</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
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
