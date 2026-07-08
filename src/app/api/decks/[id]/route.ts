import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void req;
  const { id } = await params;
  const deck = await prisma.featuredDeck.findUnique({ where: { id, active: true } });
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deck });
}
