import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getStripe } from "@/lib/stripe";
import { logAdminAction } from "@/lib/audit";

// PATCH /api/admin/discounts/[id] — activate / deactivate a promotion code.
// Body: { active: boolean }. (Stripe promotion codes can't be deleted, only
// turned off — a deactivated code stops working immediately at checkout.)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { active } = await request.json();
  const promo = await getStripe().promotionCodes.update(id, { active: !!active });

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "discount.update",
    detail: `${active ? "Enabled" : "Disabled"} code ${promo.code}`,
    request,
  });

  return NextResponse.json({ ok: true, active: promo.active });
}
