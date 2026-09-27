import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// PATCH — mark handled/unhandled. Body: { handled: boolean }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { handled } = await request.json();
  const message = await prisma.contactMessage.update({ where: { id }, data: { handled: !!handled } });
  return NextResponse.json({ message });
}

// DELETE — remove a message
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.contactMessage.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
