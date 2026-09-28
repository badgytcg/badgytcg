import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getSetInfoByIds } from "@/lib/catalog";

// GET /api/admin/scan-sessions — recent committed scan sessions with their
// cards, enriched with set / collector number / color and sorted set → name.
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await prisma.scanSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  const setInfo = await getSetInfoByIds(sessions.flatMap((s) => s.items.map((i) => i.cardId)));

  const enriched = sessions.map((s) => ({
    id: s.id,
    adminEmail: s.adminEmail,
    createdAt: s.createdAt,
    totalCards: s.totalCards,
    items: s.items
      .map((i) => {
        const meta = setInfo.get(i.cardId);
        return {
          id: i.id,
          cardName: i.cardName,
          kind: i.kind,
          qty: i.qty,
          newStock: i.newStock,
          set: meta?.set ?? null,
          cardNumber: meta?.cardNumber ?? null,
          color: meta?.color ?? null,
        };
      })
      .sort(
        (a, b) =>
          (a.set ?? "￿").localeCompare(b.set ?? "￿") ||
          a.cardName.localeCompare(b.cardName)
      ),
  }));

  return NextResponse.json({ sessions: enriched });
}
