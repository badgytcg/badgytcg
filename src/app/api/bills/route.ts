import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/bills — the signed-in customer's own bills
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ bills: [] }, { status: 200 });
  }
  const bills = await prisma.bill.findMany({
    where: { userId: session.user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ bills });
}
