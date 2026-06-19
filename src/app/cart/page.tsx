"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";

export default function CartPage() {
  const { cart, setCartQty, removeFromCart, cartTotal, clearCart, getCardById } = useStore();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          return (
            <li key={line.cardId} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-zinc-100">{card.name}</p>
                <p className="text-sm text-zinc-500">${card.price.toFixed(2)} each</p>
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
                <button onClick={() => removeFromCart(line.cardId)} className="text-sm text-red-400 hover:underline">
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
        <button onClick={clearCart} className="text-sm text-zinc-500 hover:underline">
          Clear cart
        </button>
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
