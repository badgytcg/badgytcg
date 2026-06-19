import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { cardId, price, stock } = body;
  if (typeof cardId !== "string" || typeof price !== "number" || typeof stock !== "number") {
    return NextResponse.json({ error: "Expected { cardId, price, stock }" }, { status: 400 });
  }

  const override = await prisma.cardOverride.upsert({
    where: { cardId },
    create: { cardId, price, stock },
    update: { price, stock },
  });

  return NextResponse.json({ override });
}
