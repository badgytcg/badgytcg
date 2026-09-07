"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface BillItem { id: string; cardId: string; cardName: string; qty: number; priceCents: number; }
interface Bill { id: string; status: string; note: string | null; totalCents: number; createdAt: string; items: BillItem[]; }

export default function AccountPage() {
  const { data: session, status } = useSession();
  const { wishlist, addManyToCart } = useStore();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []));
    fetch("/api/bills")
      .then((res) => res.json())
      .then((data) => setBills(data.bills ?? []));
  }, [status]);

  async function payBill(id: string) {
    setPayingId(id);
    try {
      const res = await fetch(`/api/bills/${id}/checkout`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error ?? "Couldn't start checkout.");
    } catch { alert("Couldn't reach checkout."); }
    setPayingId(null);
  }

  function addBillToCart(bill: Bill) {
    addManyToCart(bill.items.map((i) => ({ cardId: i.cardId, qty: i.qty })));
    router.push("/cart");
  }

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

      {bills.filter((b) => b.status === "open").length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-semibold text-zinc-100">Cards Ready for You</h2>
          <p className="mb-3 text-sm text-zinc-400">
            We&apos;ve sourced these cards you requested. Pay now or add them to your cart.
          </p>
          <ul className="space-y-3">
            {bills.filter((b) => b.status === "open").map((bill) => (
              <li key={bill.id} className="rounded-xl border border-purple-700/50 bg-purple-950/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">{new Date(bill.createdAt).toLocaleDateString()}</span>
                  <span className="text-lg font-bold text-purple-300">${(bill.totalCents / 100).toFixed(2)}</span>
                </div>
                <ul className="mt-2 text-sm text-zinc-300">
                  {bill.items.map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>{i.qty}x {i.cardName}</span>
                      <span className="text-zinc-500">${(i.priceCents / 100).toFixed(2)} ea</span>
                    </li>
                  ))}
                </ul>
                {bill.note && <p className="mt-2 text-xs text-zinc-400">Note: {bill.note}</p>}
                <p className="mt-1 text-xs text-zinc-500">+ shipping calculated at checkout</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => payBill(bill.id)}
                    disabled={payingId === bill.id}
                    className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:bg-zinc-700"
                  >
                    {payingId === bill.id ? "Starting checkout…" : "Pay now"}
                  </button>
                  <button
                    onClick={() => addBillToCart(bill)}
                    className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-200 hover:border-purple-500 hover:text-purple-300"
                  >
                    Add to cart
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
