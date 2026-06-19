"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";

interface SessionSummary {
  status: string;
  amountTotal: number;
  email: string | null;
  items: { name: string | null; qty: number | null }[];
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { clearCart } = useStore();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    clearCart();
    if (!sessionId) return;
    fetch(`/api/checkout/session/${sessionId}`)
      .then((res) => res.json())
      .then(setSummary)
      .catch(() => setError(true));
    // clearCart is stable across renders; only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-zinc-100">Thanks for your order!</h1>
      <p className="mt-2 text-sm text-zinc-400">
        We&apos;ll get your cards ready to ship. {summary?.email && `A receipt was sent to ${summary.email}.`}
      </p>

      {!error && summary && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-left">
          <ul className="space-y-1 text-sm text-zinc-300">
            {summary.items?.map((item, i) => (
              <li key={i}>{item.qty}x {item.name}</li>
            ))}
          </ul>
          <p className="mt-3 border-t border-zinc-800 pt-3 text-right font-semibold text-purple-300">
            Total: ${(summary.amountTotal / 100).toFixed(2)}
          </p>
        </div>
      )}

      <Link href="/vibes" className="mt-8 inline-block text-purple-400 hover:underline">
        Keep browsing →
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-6 py-16 text-center text-zinc-500">Loading...</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
