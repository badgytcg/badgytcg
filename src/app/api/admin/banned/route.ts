import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveCardById } from "@/lib/catalog";
import { logAdminAction } from "@/lib/audit";

// GET /api/admin/banned — list banned cards
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const banned = await prisma.bannedCard.findMany({ orderBy: { cardName: "asc" } });
  return NextResponse.json({ banned });
}

// POST /api/admin/banned — add a card to the ban list. Body: { cardId }
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { cardId } = await request.json();
  if (typeof cardId !== "string" || !cardId) {
    return NextResponse.json({ error: "Expected { cardId }" }, { status: 400 });
  }
  const card = await getEffectiveCardById(cardId);
  if (!card) return NextResponse.json({ error: "Unknown card" }, { status: 400 });

  const banned = await prisma.bannedCard.upsert({
    where: { cardId },
    create: { cardId, cardName: card.name },
    update: { cardName: card.name },
  });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "banned.add",
    detail: `Banned "${card.name}"`,
    request,
  });
  return NextResponse.json({ banned });
}
