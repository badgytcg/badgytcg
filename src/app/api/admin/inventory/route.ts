import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { isRateLimited, clientKeyFor } from "@/lib/rateLimit";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(clientKeyFor(request, "inventory-patch"), 120, 60_000)) {
    return NextResponse.json({ error: "Too many edits — slow down a moment." }, { status: 429 });
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

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "inventory.edit_card",
    detail: `${cardId} → $${price.toFixed(2)}, stock ${stock}`,
    request,
  });

  return NextResponse.json({ override });
}
