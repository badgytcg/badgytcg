import Stripe from "stripe";

// Lazy singleton so the build doesn't crash before STRIPE_SECRET_KEY is set —
// Stripe's constructor throws immediately on an empty key, and this module
// gets imported (and its top-level code evaluated) during the build even
// for routes that never run.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  }
  return client;
}
