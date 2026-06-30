"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export default function CartPage() {
  const { cart, setCartQty, removeFromCart, cartTotal, clearCart, getCardById } = useStore();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleCheckout() {
    setError(null);
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: cart }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start checkout.");
        setCheckingOut(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach checkout. Try again.");
      setCheckingOut(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">Your cart is empty</h1>
        <Link href="/vibes" className="mt-4 inline-block text-purple-400 hover:underline">
          Browse singles →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Your Cart</h1>
      <ul className="mt-6 divide-y divide-zinc-800">
        {cart.map((line) => {
          const card = getCardById(line.cardId);
          if (!card) return null;
          const confirming = confirmRemoveId === line.cardId;
          return (
            <li key={line.cardId} className="flex items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                  <Image
                    src={card.image}
                    alt={card.name}
                    fill
                    sizes="48px"
                    style={{ transform: "scale(1.04)" }}
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">{card.name}</p>
                  <p className="text-sm text-zinc-500">${card.price.toFixed(2)} each</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={card.stock}
                  value={line.qty}
                  onChange={(e) => setCartQty(line.cardId, Math.min(card.stock, Number(e.target.value)))}
                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                />
                <span className="w-16 text-right text-sm text-zinc-300">${(card.price * line.qty).toFixed(2)}</span>
                {confirming ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { removeFromCart(line.cardId); setConfirmRemoveId(null); }}
                      className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(line.cardId)}
                    title="Remove"
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
        {confirmClear ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Clear entire cart?</span>
            <button
              onClick={() => { clearCart(); setConfirmClear(false); }}
              className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)} className="text-sm text-zinc-500 hover:underline">
            Clear cart
          </button>
        )}
        <p className="text-lg font-semibold text-zinc-100">Total: ${cartTotal.toFixed(2)}</p>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={checkingOut}
        className="mt-6 w-full rounded-lg bg-purple-600 py-3 font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
      >
        {checkingOut ? "Redirecting to checkout..." : "Checkout"}
      </button>
    </div>
  );
}
