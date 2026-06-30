"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  detail: string;
  ip: string | null;
  createdAt: string;
}

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      });
  }, []);

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
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-purple-300">{e.action}</span>
                <span className="text-xs text-zinc-500">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{e.detail}</p>
              <p className="mt-1 text-xs text-zinc-600">{e.adminEmail}{e.ip ? ` · ${e.ip}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
