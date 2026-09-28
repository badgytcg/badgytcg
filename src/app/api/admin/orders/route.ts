import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getSetInfoByIds } from "@/lib/catalog";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    include: { items: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Attach set / collector number to each line and sort them the way the
  // admin sorts physical stock: by set, then card name A–Z. Makes an order
  // a straight pick-list instead of a random pile.
  const setInfo = await getSetInfoByIds(orders.flatMap((o) => o.items.map((i) => i.cardId)));
  const enriched = orders.map((o) => ({
    ...o,
    items: o.items
      .map((i) => {
        const s = setInfo.get(i.cardId);
        return { ...i, set: s?.set ?? null, setCode: s?.setCode ?? null, cardNumber: s?.cardNumber ?? null };
      })
      .sort(
        (a, b) =>
          (a.set ?? "￿").localeCompare(b.set ?? "￿") ||
          a.cardName.localeCompare(b.cardName)
      ),
  }));

  return NextResponse.json({ orders: enriched });
}
