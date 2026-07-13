import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

// Mask "jane.doe@gmail.com" → "j******e@gmail.com" — the success page only
// needs to hint where the receipt went, not expose the full address to
// anyone who obtains the session id.
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  const visible = local.length <= 2 ? local[0] : `${local[0]}${"*".repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}`;
  return `${visible}@${domain}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getStripe().checkout.sessions.retrieve(id, {
    expand: ["line_items"],
  });

  return NextResponse.json({
    status: session.payment_status,
    amountTotal: session.amount_total,
    email: maskEmail(session.customer_details?.email),
    items: session.line_items?.data.map((item) => ({
      name: item.description,
      qty: item.quantity,
    })),
  });
}
