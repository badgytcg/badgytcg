import type Stripe from "stripe";

export interface OrderShipping {
  shipName: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostal: string | null;
  shipCountry: string | null;
  shipPhone: string | null;
}

// Pull the shipping address out of a completed Checkout Session. Stripe has
// moved this field across API versions (shipping_details →
// collected_information.shipping_details), and billing lives on
// customer_details — so check all of them and fall back gracefully.
export function extractShipping(session: Stripe.Checkout.Session): OrderShipping {
  // Loose cast so we can read fields that differ across Stripe API versions.
  const s = session as unknown as {
    shipping_details?: { name?: string | null; address?: Stripe.Address | null; phone?: string | null };
    collected_information?: { shipping_details?: { name?: string | null; address?: Stripe.Address | null } };
    customer_details?: { name?: string | null; phone?: string | null; address?: Stripe.Address | null };
  };
  const shipping = s.collected_information?.shipping_details ?? s.shipping_details;
  const addr = shipping?.address ?? s.customer_details?.address ?? null;
  const name = shipping?.name ?? s.customer_details?.name ?? null;
  const phone = s.customer_details?.phone ?? s.shipping_details?.phone ?? null;

  return {
    shipName: name ?? null,
    shipLine1: addr?.line1 ?? null,
    shipLine2: addr?.line2 ?? null,
    shipCity: addr?.city ?? null,
    shipState: addr?.state ?? null,
    shipPostal: addr?.postal_code ?? null,
    shipCountry: addr?.country ?? null,
    shipPhone: phone ?? null,
  };
}

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
