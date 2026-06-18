import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json({ error: "No lines provided" }, { status: 400 });
  }

  const created = await prisma.wishlistItem.createMany({
    data: lines.map((line: { cardId: string | null; cardName: string; qty: number; note?: string }) => ({
      userId: session.user!.id!,
      cardId: line.cardId,
      cardName: line.cardName,
      qty: line.qty,
      note: line.note ?? null,
    })),
  });

  return NextResponse.json({ count: created.count }, { status: 201 });
}
