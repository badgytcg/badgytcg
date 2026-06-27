import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Removes the foil entirely — used when you don't even want the toggle to
// show on the card (vs. setting stock to 0, which keeps it visible as
// "Request foil").
export async function DELETE(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cardId } = await params;
  await prisma.foilOverride.deleteMany({ where: { cardId } });
  return NextResponse.json({ ok: true });
}
