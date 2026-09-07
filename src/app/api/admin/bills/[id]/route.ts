import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// DELETE /api/admin/bills/[id] — cancel an open bill (keeps paid ones intact)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bill.status === "paid") {
    return NextResponse.json({ error: "Can't cancel a paid bill." }, { status: 400 });
  }
  await prisma.bill.update({ where: { id }, data: { status: "cancelled" } });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "bills.cancel",
    detail: `Cancelled bill ${id}`,
    request,
  });
  return NextResponse.json({ ok: true });
}
