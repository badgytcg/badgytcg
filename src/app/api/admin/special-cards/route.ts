import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cards = await prisma.specialCard.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ cards });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, imageUrl, price, grade, set, qty } = body;
  if (typeof name !== "string" || typeof imageUrl !== "string" || typeof price !== "number") {
    return NextResponse.json({ error: "Expected { name, imageUrl, price }" }, { status: 400 });
  }

  const card = await prisma.specialCard.create({
    data: {
      name,
      imageUrl,
      price,
      description: description ?? null,
      grade: grade ?? null,
      set: set ?? null,
      qty: typeof qty === "number" && qty > 0 ? Math.floor(qty) : 1,
    },
  });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "special_cards.create",
    detail: `Added "${card.name}" — $${card.price.toFixed(2)} x${card.qty}`,
    request,
  });
  return NextResponse.json({ card }, { status: 201 });
}
