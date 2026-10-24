import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const items = await prisma.orderItem.findMany({
    where: {
      ...(owner ? { owner } : {}),
      order: {
        // All completed sales count — including delivered (Complete) orders.
        // Only cancelled/refunded are left out.
        status: { in: ["paid", "fulfilled", "delivered"] },
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
              },
            }
          : {}),
      },
    },
    include: { order: { select: { createdAt: true, status: true, stripeSessionId: true, guestEmail: true } } },
    orderBy: { order: { createdAt: "desc" } },
  });

  const totalCents = items.reduce((s, i) => s + i.priceCents * i.qty, 0);

  return NextResponse.json({ items, totalCents });
}
