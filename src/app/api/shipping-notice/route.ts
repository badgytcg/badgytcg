import { NextResponse } from "next/server";
import { getShippingNotice } from "@/lib/shippingNotice";

// Public: the current shipping-delay notice for the storefront banner.
export async function GET() {
  const notice = await getShippingNotice();
  return NextResponse.json(notice);
}
