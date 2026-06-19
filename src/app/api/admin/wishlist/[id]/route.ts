import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Admin marks a wishlist request as fulfilled by deleting it (e.g. once the
// card has been sourced and handed off / sold to the customer outside the
// site's checkout, since checkout doesn't exist yet).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.wishlistItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
