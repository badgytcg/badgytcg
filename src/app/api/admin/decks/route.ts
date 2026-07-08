import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function GET(req: NextRequest) {
  void req;
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const decks = await prisma.featuredDeck.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ decks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, type, description, price, discount, cardList, active, sortOrder } = body;
  if (!name || !type || !cardList) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const deck = await prisma.featuredDeck.create({
    data: {
      name, type,
      description: description ?? null,
      price: price != null && Number(price) > 0 ? Number(price) : null,
      discount: discount ? Number(discount) : 0,
      cardList,
      active: active ?? true,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json({ deck });
}
