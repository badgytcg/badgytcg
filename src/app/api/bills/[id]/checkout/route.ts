import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { buildShippingOptions } from "@/lib/shipping";
import { isRateLimited, clientKeyFor } from "@/lib/rateLimit";

// POST /api/bills/[id]/checkout — start Stripe checkout for a private bill.
// Uses the prices snapshotted on the bill (not live prices).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Checkout isn't set up yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (isRateLimited(clientKeyFor(request, "bill-checkout"), 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — wait a minute." }, { status: 429 });
  }

  const { id } = await params;
  const bill = await prisma.bill.findUnique({ where: { id }, include: { items: true } });
  if (!bill || bill.userId !== session.user.id) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  if (bill.status !== "open") {
    return NextResponse.json({ error: `This bill is already ${bill.status}.` }, { status: 400 });
  }

  const lineItems = bill.items.map((it) => ({
    price_data: {
      currency: "usd",
      unit_amount: it.priceCents,
      product_data: { name: it.cardName, metadata: { cardId: it.cardId } },
    },
    quantity: it.qty,
  }));

  const subtotalCents = bill.items.reduce((s, i) => s + i.priceCents * i.qty, 0);
  const totalCards = bill.items.reduce((s, i) => s + i.qty, 0);
  const origin = request.headers.get("origin") ?? `https://${request.headers.get("host")}`;

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: buildShippingOptions(subtotalCents, totalCards),
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account`,
    client_reference_id: session.user.id,
    customer_email: session.user.email ?? undefined,
    // Tag the session so the Stripe webhook can mark this bill paid.
    metadata: { billId: bill.id },
  });

  await prisma.bill.update({ where: { id: bill.id }, data: { stripeSessionId: checkoutSession.id } });

  return NextResponse.json({ url: checkoutSession.url });
}
