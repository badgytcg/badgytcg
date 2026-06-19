import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getEffectiveCardById } from "@/lib/catalog";
import type Stripe from "stripe";

// Stripe needs the raw, unparsed request body to verify the signature.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Stripe retries webhooks; bail out if we've already recorded this session.
  const existing = await prisma.order.findUnique({ where: { stripeSessionId: session.id } });
  if (existing) {
    return NextResponse.json({ received: true });
  }

  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, {
    expand: ["data.price.product"],
  });

  const orderItems = lineItems.data.map((item) => {
    const product = item.price?.product as Stripe.Product;
    return {
      cardId: product.metadata.cardId as string,
      cardName: product.name,
      qty: item.quantity ?? 1,
      priceCents: item.price?.unit_amount ?? 0,
    };
  });

  await prisma.order.create({
    data: {
      userId: session.client_reference_id || null,
      guestEmail: session.client_reference_id ? null : session.customer_details?.email,
      stripeSessionId: session.id,
      status: "paid",
      totalCents: session.amount_total ?? 0,
      items: { create: orderItems },
    },
  });

  // Decrement stock for each purchased card.
  for (const item of orderItems) {
    const current = await getEffectiveCardById(item.cardId);
    if (!current) continue;
    const newStock = Math.max(0, current.stock - item.qty);
    await prisma.cardOverride.upsert({
      where: { cardId: item.cardId },
      create: { cardId: item.cardId, price: current.price, stock: newStock },
      update: { stock: newStock },
    });
  }

  return NextResponse.json({ received: true });
}
