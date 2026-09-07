import type Stripe from "stripe";

// Shipping is sized by card count — a heavy order costs real postage no
// matter what it's worth. No free-shipping tier: orders can ship from two
// different consigners, so we always charge postage.
//   - Over 50 cards: small box, flat $8.99 tracked
//   - 13–50 cards (or $20+ subtotal): bubble mailer, $4.99 tracked
//   - ≤12 cards under $20: PWE option ($1.29, untracked) alongside tracked
export function buildShippingOptions(
  subtotalCents: number,
  totalCards: number
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const trackedEstimate = {
    minimum: { unit: "business_day" as const, value: 3 },
    maximum: { unit: "business_day" as const, value: 7 },
  };
  const boxOption = {
    shipping_rate_data: {
      display_name: "USPS Ground Advantage — Small Box (tracked)",
      type: "fixed_amount" as const,
      fixed_amount: { amount: 899, currency: "usd" },
      delivery_estimate: trackedEstimate,
    },
  };
  const trackedOption = {
    shipping_rate_data: {
      display_name: "USPS Ground Advantage — Bubble Mailer (tracked)",
      type: "fixed_amount" as const,
      fixed_amount: { amount: 499, currency: "usd" },
      delivery_estimate: trackedEstimate,
    },
  };
  const pweOption = {
    shipping_rate_data: {
      display_name: "Plain White Envelope (no tracking)",
      type: "fixed_amount" as const,
      fixed_amount: { amount: 129, currency: "usd" },
      delivery_estimate: {
        minimum: { unit: "business_day" as const, value: 4 },
        maximum: { unit: "business_day" as const, value: 10 },
      },
    },
  };

  return totalCards > 50
    ? [boxOption]
    : totalCards <= 12 && subtotalCents < 2000
      ? [pweOption, trackedOption]
      : [trackedOption];
}
