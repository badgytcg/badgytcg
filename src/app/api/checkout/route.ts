import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEffectiveCardById } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";
import { isRateLimited, clientKeyFor } from "@/lib/rateLimit";
import { buildShippingOptions } from "@/lib/shipping";

interface CheckoutLine {
  cardId: string;
  qty: number;
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Checkout isn't set up yet — payments are coming soon." },
      { status: 503 }
    );
  }

  // Anyone can hit checkout without signing in — cap session creation per IP
  // so a bot can't spam Stripe checkout sessions.
  if (isRateLimited(clientKeyFor(request, "checkout"), 10, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts — wait a minute and try again." }, { status: 429 });
  }

  const session = await auth();
  const body = await request.json();
  const lines: CheckoutLine[] = Array.isArray(body.lines) ? body.lines : [];

  if (lines.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Re-validate every line against the live catalog server-side — never
  // trust price or stock numbers the client sends.
  const lineItems: Array<{
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string; metadata: { cardId: string } };
    };
    quantity: number;
  }> = [];

  for (const line of lines) {
    const card = await getEffectiveCardById(line.cardId);
    if (!card) {
      return NextResponse.json({ error: `Card ${line.cardId} not found` }, { status: 400 });
    }
    if (line.qty <= 0 || line.qty > card.stock) {
      return NextResponse.json(
        { error: `Only ${card.stock} of "${card.name}" left in stock` },
        { status: 400 }
      );
    }
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(card.price * 100),
        product_data: { name: card.name, metadata: { cardId: card.id } },
      },
      quantity: line.qty,
    });
  }

  const origin = request.headers.get("origin") ?? `https://${request.headers.get("host")}`;

  const subtotalCents = lineItems.reduce(
    (sum, li) => sum + li.price_data.unit_amount * li.quantity,
    0
  );
  const totalCards = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: buildShippingOptions(subtotalCents, totalCards),
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
    client_reference_id: session?.user?.id,
    customer_email: session?.user?.email ?? undefined,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
