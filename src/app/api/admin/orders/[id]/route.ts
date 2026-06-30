import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

const VALID_STATUSES = ["pending", "paid", "fulfilled", "cancelled"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await request.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const order = await prisma.order.update({ where: { id }, data: { status } });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "orders.set_status",
    detail: `Order ${id} → ${status}`,
    request,
  });
  return NextResponse.json({ order });
}
