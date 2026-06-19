import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Admin</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/admin/requests" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-purple-500">
          <h2 className="font-semibold text-zinc-100">Requests</h2>
          <p className="mt-1 text-sm text-zinc-400">Wishlist &amp; deck requests across all customers to source.</p>
        </Link>
        <Link href="/admin/inventory" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-purple-500">
          <h2 className="font-semibold text-zinc-100">Inventory</h2>
          <p className="mt-1 text-sm text-zinc-400">Edit price &amp; stock for any card, live.</p>
        </Link>
        <Link href="/admin/orders" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-purple-500">
          <h2 className="font-semibold text-zinc-100">Orders</h2>
          <p className="mt-1 text-sm text-zinc-400">Paid orders once checkout is live; update fulfillment status.</p>
        </Link>
      </div>
    </div>
  );
}
