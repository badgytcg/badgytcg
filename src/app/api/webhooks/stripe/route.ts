import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { decrementStockAfterPurchase } from "@/lib/catalog";
import { sendEmail, adminAlertEmail } from "@/lib/email";
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

  // Snapshot consigner ownership at the moment of sale so reports remain
  // accurate even if ownership is later re-assigned in inventory.
  const cardIds = lineItems.data.map((item) => {
    const product = item.price?.product as Stripe.Product;
    return product.metadata.cardId as string;
  });
  const overrides = await prisma.cardOverride.findMany({ where: { cardId: { in: cardIds } } });
  const ownerByCardId = new Map(overrides.map((o) => [o.cardId, o.owner]));

  const orderItems = lineItems.data.map((item) => {
    const product = item.price?.product as Stripe.Product;
    const cardId = product.metadata.cardId as string;
    return {
      cardId,
      cardName: product.name,
      qty: item.quantity ?? 1,
      priceCents: item.price?.unit_amount ?? 0,
      owner: ownerByCardId.get(cardId) ?? "badgy",
    };
  });

  const order = await prisma.order.create({
    data: {
      userId: session.client_reference_id || null,
      guestEmail: session.client_reference_id ? null : session.customer_details?.email,
      stripeSessionId: session.id,
      status: "paid",
      totalCents: session.amount_total ?? 0,
      items: { create: orderItems },
    },
  });

  // Decrement stock for each purchased card (or remove it, for one-off specials).
  for (const item of orderItems) {
    await decrementStockAfterPurchase(item.cardId, item.qty);
  }

  const alertTo = adminAlertEmail();
  if (alertTo) {
    const buyerEmail = order.guestEmail ?? session.customer_details?.email ?? "(signed-in user)";
    const lines = orderItems.map((i) => `  ${i.qty}x ${i.cardName} — $${(i.priceCents / 100).toFixed(2)} ea`);
    try {
      await sendEmail({
        to: alertTo,
        subject: `New order — $${(order.totalCents / 100).toFixed(2)}`,
        text: [
          `New order from ${buyerEmail}`,
          `Total: $${(order.totalCents / 100).toFixed(2)}`,
          "",
          "Items:",
          ...lines,
          "",
          `Order ID: ${order.id}`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[order alert email] failed:", err);
    }
  }

  return NextResponse.json({ received: true });
}
