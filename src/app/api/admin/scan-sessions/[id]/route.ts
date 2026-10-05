import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getSetInfoByIds } from "@/lib/catalog";

// GET /api/admin/scan-sessions/[id] — one session's cards, enriched with set /
// collector number / color and sorted set → name. Used by the Activity Log
// dropdown to show what a given scan added.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const scan = await prisma.scanSession.findUnique({ where: { id }, include: { items: true } });
  if (!scan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const setInfo = await getSetInfoByIds(scan.items.map((i) => i.cardId));
  const items = scan.items
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
    );

  return NextResponse.json({ id: scan.id, createdAt: scan.createdAt, totalCards: scan.totalCards, items });
}
