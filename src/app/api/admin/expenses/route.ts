import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

const CATEGORIES = ["cards", "supplies", "shipping", "fees", "other"];

// GET /api/admin/expenses — the cost ledger plus the shop P&L:
//   grossSalesCents: money received across all completed orders (all time)
//   totalCostCents:  sum of every logged expense
//   netCents:        grossSales - totalCost (profit if positive)
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [expenses, costAgg, salesAgg] = await Promise.all([
    prisma.shopExpense.findMany({ orderBy: { spentAt: "desc" } }),
    prisma.shopExpense.aggregate({ _sum: { amountCents: true } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: ["paid", "fulfilled", "delivered"] } },
    }),
  ]);

  const totalCostCents = costAgg._sum.amountCents ?? 0;
  const grossSalesCents = salesAgg._sum.totalCents ?? 0;

  // Per-category breakdown for the summary.
  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountCents;

  return NextResponse.json({
    expenses,
    totalCostCents,
    grossSalesCents,
    netCents: grossSalesCents - totalCostCents,
    byCategory,
  });
}

// POST /api/admin/expenses — add a cost line. Body: { label, amount (dollars),
// category?, note?, spentAt? }
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const label = String(body?.label ?? "").trim();
  const amountCents = Math.round(Number(body?.amount) * 100);
  const category = CATEGORIES.includes(body?.category) ? body.category : "cards";
  const note = body?.note ? String(body.note).trim() : null;
  const spentAt = body?.spentAt ? new Date(body.spentAt) : new Date();

  if (!label) return NextResponse.json({ error: "Add a label for what you bought." }, { status: 400 });
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Enter an amount greater than $0." }, { status: 400 });
  }

  const expense = await prisma.shopExpense.create({
    data: { label, amountCents, category, note, spentAt: isNaN(spentAt.getTime()) ? new Date() : spentAt },
  });
  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "expense.add",
    detail: `Logged cost: ${label} — $${(amountCents / 100).toFixed(2)} (${category})`,
    request,
  });
  return NextResponse.json({ expense });
}
