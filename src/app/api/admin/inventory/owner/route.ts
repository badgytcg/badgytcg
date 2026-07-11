import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// GET /api/admin/inventory/owner — returns {cardId, owner, ownerSplit} for all CardOverride rows
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const overrides = await prisma.cardOverride.findMany({
    select: { cardId: true, owner: true, ownerSplit: true },
  });
  return NextResponse.json({ overrides });
}

// PATCH /api/admin/inventory/owner — update owner / ownerSplit on one card override
// Body: { cardId, owner?, ownerSplit? }
//   owner: string — sets single primary owner (clears split)
//   ownerSplit: [{owner,qty}] | null — sets split; pass null to clear back to single owner
export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { cardId, owner, ownerSplit } = await request.json();
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const splitJson = ownerSplit != null ? JSON.stringify(ownerSplit) : null;
  const primaryOwner = owner ?? (ownerSplit?.[0]?.owner ?? "badgy");

  await prisma.cardOverride.upsert({
    where: { cardId },
    create: { cardId, price: 0, stock: 0, owner: primaryOwner, ownerSplit: splitJson },
    update: {
      ...(owner !== undefined && { owner }),
      ownerSplit: splitJson !== undefined ? splitJson : undefined,
    },
  });

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "inventory.set_owner",
    detail: ownerSplit != null
      ? `Split ownership of ${cardId}: ${ownerSplit.map((s: { owner: string; qty: number }) => `${s.qty}×${s.owner}`).join(", ")}`
      : `Set owner of ${cardId} to "${owner}"`,
    request,
  });
  return NextResponse.json({ ok: true });
}
