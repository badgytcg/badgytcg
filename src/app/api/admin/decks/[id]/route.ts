import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { name, type, description, price, cardList, active, sortOrder } = body;
  const deck = await prisma.featuredDeck.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: Number(price) }),
      ...(cardList !== undefined && { cardList }),
      ...(active !== undefined && { active }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  return NextResponse.json({ deck });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void req;
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.featuredDeck.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
