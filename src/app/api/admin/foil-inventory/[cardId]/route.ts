import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { VARIANT_KINDS } from "@/lib/catalog";

// Removes the variant entirely — used when you don't even want the toggle to
// show on the card (vs. setting stock to 0, which keeps it visible as
// "Request foil"). Pass ?kind=foil or ?kind=altfoil.
export async function DELETE(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cardId } = await params;
  const kind = new URL(request.url).searchParams.get("kind");
  if (!kind || !VARIANT_KINDS.includes(kind as never)) {
    return NextResponse.json({ error: "Expected ?kind=foil or ?kind=altfoil" }, { status: 400 });
  }

  await prisma.cardVariantOverride.deleteMany({ where: { cardId, kind } });
  return NextResponse.json({ ok: true });
}
