import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const consigners = await prisma.consigner.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ consigners });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { slug, name, email } = await request.json();
  if (!slug || !name) return NextResponse.json({ error: "slug and name required" }, { status: 400 });
  const clean = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  const consigner = await prisma.consigner.upsert({
    where: { slug: clean },
    create: { slug: clean, name, email: email || null },
    update: { name, email: email || null },
  });
  return NextResponse.json({ consigner });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { slug } = await request.json();
  if (slug === "badgy") return NextResponse.json({ error: "Cannot delete the primary owner" }, { status: 400 });
  await prisma.consigner.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
