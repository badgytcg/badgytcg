import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, description, imageUrl, price, grade, set } = body;

  const card = await prisma.specialCard.update({
    where: { id },
    data: { name, description, imageUrl, price, grade, set },
  });
  return NextResponse.json({ card });
}

// Removing the row is how you mark it sold — there's no stock field, since
// "listed at all" is the only availability signal for these one-offs.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.specialCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
