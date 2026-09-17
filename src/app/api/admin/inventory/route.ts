import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { getEffectiveCardById } from "@/lib/catalog";
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

  // Capture the current values before the write so the log can show old → new.
  const before = await getEffectiveCardById(cardId);
  const name = before?.name ?? cardId;
  const oldPrice = before?.price;
  const oldStock = before?.stock;

  const override = await prisma.cardOverride.upsert({
    where: { cardId },
    create: { cardId, price, stock },
    update: { price, stock },
  });

  const changes: string[] = [];
  if (oldStock !== undefined && oldStock !== stock) changes.push(`stock ${oldStock} → ${stock}`);
  else changes.push(`stock ${stock}`);
  if (oldPrice !== undefined && oldPrice !== price) changes.push(`price $${oldPrice.toFixed(2)} → $${price.toFixed(2)}`);
  else changes.push(`price $${price.toFixed(2)}`);

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "inventory.edit_card",
    detail: `${name}: ${changes.join(", ")}`,
    request,
  });

  return NextResponse.json({ override });
}
