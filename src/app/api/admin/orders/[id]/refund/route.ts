import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/orders/[id]/refund — refund a paid order through Stripe.
// Full refund of the captured payment; marks the order "refunded".
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe isn't configured." }, { status: 503 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "refunded") {
    return NextResponse.json({ error: "This order is already refunded." }, { status: 400 });
  }
  if (order.status === "pending") {
    return NextResponse.json({ error: "This order was never paid, so there's nothing to refund." }, { status: 400 });
  }

  // The order stores the Checkout Session id; the refund needs its PaymentIntent.
  let paymentIntentId: string | null = null;
  try {
    const checkout = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
    paymentIntentId = typeof checkout.payment_intent === "string"
      ? checkout.payment_intent
      : checkout.payment_intent?.id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `Couldn't load the payment from Stripe: ${msg}` }, { status: 502 });
  }
  if (!paymentIntentId) {
    return NextResponse.json({ error: "No captured payment found for this order." }, { status: 400 });
  }

  try {
    await getStripe().refunds.create({ payment_intent: paymentIntentId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // e.g. "Charge has already been refunded"
    return NextResponse.json({ error: `Stripe refund failed: ${msg}` }, { status: 502 });
  }

  await prisma.order.update({ where: { id }, data: { status: "refunded" } });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "orders.refund",
    detail: `Refunded order ${id} — $${(order.totalCents / 100).toFixed(2)}`,
    request,
  });

  return NextResponse.json({ ok: true, status: "refunded" });
}
