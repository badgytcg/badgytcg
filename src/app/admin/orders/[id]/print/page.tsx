import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function OrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // This slip shows the customer's shipping address — gate it server-side.
  if (!isAdminEmail(session?.user?.email)) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-zinc-400">Not authorized.</div>;
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, user: { select: { email: true, name: true } } },
  });
  if (!order) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-zinc-400">Order not found.</div>;
  }

  const subtotal = order.items.reduce((s, i) => s + i.priceCents * i.qty, 0);
  const shipping = Math.max(0, order.totalCents - subtotal);
  const custEmail = order.user?.email ?? order.guestEmail;
  const hasAddr = !!order.shipLine1;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-zinc-100">Packing Slip</h1>
        <PrintButton />
      </div>

      {/* The "paper" — white so it reads on screen and prints clean */}
      <div className="rounded-xl bg-white p-8 text-black shadow-lg print:rounded-none print:p-6 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <p className="text-2xl font-extrabold tracking-tight">BADGY TCG</p>
            <p className="text-sm text-zinc-600">badgytcg.com</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Order #{order.id.slice(-6).toUpperCase()}</p>
            <p className="text-zinc-600">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-zinc-500">Ship To</p>
            {hasAddr ? (
              <div className="text-zinc-800">
                <p className="font-medium">{order.shipName}</p>
                <p>{order.shipLine1}</p>
                {order.shipLine2 && <p>{order.shipLine2}</p>}
                <p>{order.shipCity}, {order.shipState} {order.shipPostal}</p>
                {order.shipCountry && order.shipCountry !== "US" && <p>{order.shipCountry}</p>}
              </div>
            ) : (
              <p className="text-zinc-800">{custEmail ?? "—"}</p>
            )}
          </div>
          <div className="text-right">
            <p className="mb-1 font-semibold uppercase tracking-wide text-zinc-500">Contact</p>
            <p className="text-zinc-800">{custEmail ?? "—"}</p>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Unit</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-zinc-300">
                <td className="py-2 pr-2">{i.qty}</td>
                <td className="py-2 pr-2">{i.cardName}</td>
                <td className="py-2 pr-2 text-right">{money(i.priceCents)}</td>
                <td className="py-2 text-right">{money(i.priceCents * i.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-zinc-600">Subtotal</td>
              <td className="pt-3 text-right">{money(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-1 text-right text-zinc-600">Shipping</td>
              <td className="py-1 text-right">{money(shipping)}</td>
            </tr>
            <tr className="border-t-2 border-black text-base font-bold">
              <td colSpan={3} className="pt-2 text-right">Total</td>
              <td className="pt-2 text-right">{money(order.totalCents)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 border-t border-zinc-300 pt-4 text-center text-sm text-zinc-600">
          <p className="font-medium text-black">Thanks for your order! 🐧</p>
          <p className="mt-1">Questions about your order? Email badgytcg@gmail.com</p>
          <p>Shop again at badgytcg.com</p>
        </div>
      </div>
    </div>
  );
}
