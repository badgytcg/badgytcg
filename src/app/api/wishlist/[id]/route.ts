import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  // Scope the delete to this user so one account can't delete another's items.
  await prisma.wishlistItem.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
