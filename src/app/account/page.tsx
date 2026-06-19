"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useStore } from "@/context/StoreContext";

const DECK_REQUEST_PREFIX = "Deck request:";
const DECK_IMPORT_PREFIX = "from deck import:";
const CARD_REQUEST_NOTE = "Card request";

interface OrderItem {
  id: string;
  cardName: string;
  qty: number;
  priceCents: number;
}

interface Order {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const { wishlist } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []));
  }, [status]);

  if (status === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Save your wishlist and see your order history across visits.
        </p>
        <button
          onClick={() => signIn("google")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-100 hover:border-purple-500"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center gap-4">
        {session?.user?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-14 w-14 rounded-full" />
        )}
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{session?.user?.name}</h1>
          <p className="text-sm text-zinc-500">{session?.user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="ml-auto rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Wishlist</h2>
          <Link href="/wishlist" className="text-sm text-purple-400 hover:underline">
            View all →
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {wishlist.filter((l) => l.note !== CARD_REQUEST_NOTE && !l.note?.startsWith(DECK_REQUEST_PREFIX) && !l.note?.startsWith(DECK_IMPORT_PREFIX)).length} wishlist,{" "}
          {wishlist.filter((l) => l.note === CARD_REQUEST_NOTE).length} card request(s),{" "}
          {wishlist.filter((l) => l.note?.startsWith(DECK_REQUEST_PREFIX) || l.note?.startsWith(DECK_IMPORT_PREFIX)).length} deck request item(s)
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Order History</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No orders yet — once checkout is live, your purchases will show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-zinc-800 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300">
                    {new Date(order.createdAt).toLocaleDateString()} · {order.status}
                  </span>
                  <span className="font-medium text-purple-300">
                    ${(order.totalCents / 100).toFixed(2)}
                  </span>
                </div>
                <ul className="mt-2 text-xs text-zinc-500">
                  {order.items.map((item) => (
                    <li key={item.id}>{item.qty}x {item.cardName}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
