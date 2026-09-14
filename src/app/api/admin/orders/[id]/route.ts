import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

const VALID_STATUSES = ["pending", "paid", "fulfilled", "cancelled", "refunded"];
const VALID_CARRIERS = ["usps", "ups", "fedex", "other"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, trackingNumber, trackingCarrier } = body as {
    status?: string;
    trackingNumber?: string | null;
    trackingCarrier?: string | null;
  };

  const data: Record<string, unknown> = {};
  const details: string[] = [];

  // Status update (unchanged behaviour).
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    data.status = status;
    details.push(`status → ${status}`);
  }

  // Tracking update. Adding a tracking number marks the order fulfilled
  // (unless the caller is explicitly setting a different status this call).
  if (trackingNumber !== undefined) {
    const num = trackingNumber?.trim() || null;
    const carrier = num ? (trackingCarrier && VALID_CARRIERS.includes(trackingCarrier) ? trackingCarrier : "usps") : null;
    data.trackingNumber = num;
    data.trackingCarrier = carrier;
    details.push(num ? `tracking ${carrier}:${num}` : "tracking cleared");
    if (num && status === undefined) data.status = "fulfilled";
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const order = await prisma.order.update({ where: { id }, data });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "orders.update",
    detail: `Order ${id}: ${details.join(", ")}`,
    request,
  });
  return NextResponse.json({ order });
}
