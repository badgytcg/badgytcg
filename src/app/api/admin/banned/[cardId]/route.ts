import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// DELETE /api/admin/banned/[cardId] — remove a card from the ban list
export async function DELETE(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { cardId } = await params;
  const existing = await prisma.bannedCard.findUnique({ where: { cardId } });
  if (existing) {
    await prisma.bannedCard.delete({ where: { cardId } });
    await logAdminAction({
      adminEmail: session!.user!.email!,
      action: "banned.remove",
      detail: `Unbanned "${existing.cardName}"`,
      request,
    });
  }
  return NextResponse.json({ ok: true });
}
