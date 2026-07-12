import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/market-prices — manually set a market price for any card/variant
// Body: { cardId, source, price }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cardId, source, price } = await req.json();
  if (typeof cardId !== "string" || typeof source !== "string" || typeof price !== "number") {
    return NextResponse.json({ error: "Expected { cardId, source, price }" }, { status: 400 });
  }

  const LABEL: Record<string, string> = { dyli: "Dyli", minmax: "MinMax Games", scg: "StarCityGames" };

  const record = await prisma.marketPrice.upsert({
    where: { cardId_source: { cardId, source } },
    create: { cardId, source, label: LABEL[source] ?? source, price, currency: "USD" },
    update: { price, label: LABEL[source] ?? source },
  });

  return NextResponse.json({ record });
}
