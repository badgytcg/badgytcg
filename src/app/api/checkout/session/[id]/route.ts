import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getStripe().checkout.sessions.retrieve(id, {
    expand: ["line_items"],
  });

  return NextResponse.json({
    status: session.payment_status,
    amountTotal: session.amount_total,
    email: session.customer_details?.email,
    items: session.line_items?.data.map((item) => ({
      name: item.description,
      qty: item.quantity,
    })),
  });
}
