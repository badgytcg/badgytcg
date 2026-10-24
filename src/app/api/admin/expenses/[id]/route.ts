import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// DELETE /api/admin/expenses/[id] — remove a cost line.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.shopExpense.findUnique({ where: { id } });
  await prisma.shopExpense.deleteMany({ where: { id } });
  if (existing) {
    await logAdminAction({
      adminEmail: session!.user!.email!,
      action: "expense.delete",
      detail: `Removed cost: ${existing.label} — $${(existing.amountCents / 100).toFixed(2)}`,
      request,
    });
  }
  return NextResponse.json({ ok: true });
}
