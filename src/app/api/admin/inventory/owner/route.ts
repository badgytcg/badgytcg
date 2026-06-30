import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// GET /api/admin/inventory/owner — returns {cardId, owner} for all CardOverride rows
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const overrides = await prisma.cardOverride.findMany({ select: { cardId: true, owner: true } });
  return NextResponse.json({ overrides });
}

// PATCH /api/admin/inventory/owner — update the consigner owner on one card override
export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { cardId, owner } = await request.json();
  if (!cardId || !owner) return NextResponse.json({ error: "cardId and owner required" }, { status: 400 });

  await prisma.cardOverride.update({ where: { cardId }, data: { owner } });
  return NextResponse.json({ ok: true });
}
