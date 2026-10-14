import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getStripe } from "@/lib/stripe";
import { logAdminAction } from "@/lib/audit";

// The coupon tied to a promotion code lives at promotion.coupon; expanded, it
// is the full Coupon object (string id otherwise).
function couponOf(p: Stripe.PromotionCode): Stripe.Coupon | null {
  const c = p.promotion?.coupon;
  return c && typeof c === "object" ? c : null;
}

// GET /api/admin/discounts — list promotion codes (customer-facing codes)
// with their coupon's discount and usage. Stripe is the source of truth.
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const promos = await getStripe().promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
  const codes = promos.data.map((p) => {
    const coupon = couponOf(p);
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      percentOff: coupon?.percent_off ?? null,
      amountOff: coupon?.amount_off ?? null,
      duration: coupon?.duration ?? null,
      maxRedemptions: p.max_redemptions ?? null,
      timesRedeemed: p.times_redeemed,
      createdAt: new Date(p.created * 1000).toISOString(),
    };
  });
  return NextResponse.json({ codes });
}

// POST /api/admin/discounts — create a new discount code.
// Body: { code, percentOff? , amountOffCents?, maxRedemptions? }
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const stripe = getStripe();
  const body = await request.json();

  const rawCode = String(body?.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(rawCode)) {
    return NextResponse.json({ error: "Code must be 3–40 characters: letters, numbers, or dashes." }, { status: 400 });
  }

  const percentOff = body?.percentOff != null ? Number(body.percentOff) : null;
  const amountOffCents = body?.amountOffCents != null ? Math.round(Number(body.amountOffCents)) : null;
  if (percentOff == null && amountOffCents == null) {
    return NextResponse.json({ error: "Set either a percent-off or a dollar-amount-off." }, { status: 400 });
  }
  if (percentOff != null && (percentOff <= 0 || percentOff > 100)) {
    return NextResponse.json({ error: "Percent off must be between 1 and 100." }, { status: 400 });
  }
  if (amountOffCents != null && amountOffCents <= 0) {
    return NextResponse.json({ error: "Dollar amount off must be greater than $0." }, { status: 400 });
  }

  const maxRedemptions = body?.maxRedemptions != null && Number(body.maxRedemptions) > 0
    ? Math.round(Number(body.maxRedemptions))
    : undefined;

  // Reject a code string already in use by an active promotion code.
  const existing = await stripe.promotionCodes.list({ code: rawCode, active: true, limit: 1 });
  if (existing.data.length) {
    return NextResponse.json({ error: `Code "${rawCode}" is already active.` }, { status: 409 });
  }

  const coupon = await stripe.coupons.create({
    duration: "once", // applies to the one order the code is used on
    name: percentOff != null ? `${percentOff}% off` : `$${(amountOffCents! / 100).toFixed(2)} off`,
    ...(percentOff != null ? { percent_off: percentOff } : { amount_off: amountOffCents!, currency: "usd" }),
  });

  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: rawCode,
    ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
  });

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "discount.create",
    detail: `Created code ${rawCode} — ${percentOff != null ? `${percentOff}% off` : `$${(amountOffCents! / 100).toFixed(2)} off`}${maxRedemptions ? `, max ${maxRedemptions} uses` : ", unlimited uses"}`,
    request,
  });

  return NextResponse.json({
    code: {
      id: promo.id,
      code: promo.code,
      active: promo.active,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      duration: coupon.duration,
      maxRedemptions: promo.max_redemptions ?? null,
      timesRedeemed: promo.times_redeemed,
      createdAt: new Date(promo.created * 1000).toISOString(),
    },
  });
}
