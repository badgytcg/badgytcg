import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getEffectiveCardById } from "@/lib/catalog";
import { sendEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";

// GET /api/admin/bills — all bills + the list of customers to bill
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [bills, customers] = await Promise.all([
    prisma.bill.findMany({
      include: { items: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { email: { not: null } },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ bills, customers });
}

// POST /api/admin/bills — create a private bill for a customer
// Body: { userId, items: [{ cardId, qty }], note? }
// Prices are snapshotted from the current store price at creation.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, items, note } = await request.json();
  if (typeof userId !== "string" || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Expected { userId, items: [{cardId, qty}] }" }, { status: 400 });
  }

  const customer = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const billItems: { cardId: string; cardName: string; qty: number; priceCents: number }[] = [];
  for (const it of items) {
    const qty = Number(it.qty);
    if (!it.cardId || !Number.isFinite(qty) || qty <= 0) continue;
    const card = await getEffectiveCardById(it.cardId);
    if (!card) return NextResponse.json({ error: `Card ${it.cardId} not found` }, { status: 400 });
    billItems.push({ cardId: card.id, cardName: card.name, qty, priceCents: Math.round(card.price * 100) });
  }
  if (billItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const totalCents = billItems.reduce((s, i) => s + i.priceCents * i.qty, 0);

  const bill = await prisma.bill.create({
    data: {
      userId,
      note: note || null,
      totalCents,
      items: { create: billItems },
    },
    include: { items: true },
  });

  // Notify the customer (best-effort — never block bill creation on email).
  if (customer.email) {
    const origin = request.headers.get("origin") ?? `https://${request.headers.get("host")}`;
    const lines = billItems.map((i) => `  ${i.qty}x ${i.cardName} — $${(i.priceCents / 100).toFixed(2)} ea`);
    try {
      await sendEmail({
        to: customer.email,
        subject: `Your BadgyTCG cards are ready — $${(totalCents / 100).toFixed(2)}`,
        text: [
          `Hi${customer.name ? " " + customer.name : ""},`,
          "",
          "We've put together the cards you requested. They're ready to buy on your account:",
          "",
          ...lines,
          "",
          `Total: $${(totalCents / 100).toFixed(2)}`,
          note ? `\nNote: ${note}` : "",
          "",
          `Pay or add them to your cart here: ${origin}/account`,
          "",
          "— BadgyTCG",
        ].join("\n"),
      });
    } catch (err) {
      console.error("[bill email] failed:", err);
    }
  }

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "bills.create",
    detail: `Billed ${customer.email ?? userId} $${(totalCents / 100).toFixed(2)} (${billItems.length} line(s))`,
    request,
  });

  return NextResponse.json({ bill });
}
