import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { subject, message } = body as { subject?: string; message?: string };
  if (typeof subject !== "string" || !subject.trim() || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "subject and message are required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const to = order.user?.email ?? order.guestEmail;
  if (!to) {
    return NextResponse.json({ error: "This order has no customer email on file" }, { status: 400 });
  }

  const sent = await sendEmail({ to, subject, text: message });
  if (!sent) {
    return NextResponse.json({ error: "Email isn't configured (GMAIL_USER/GMAIL_APP_PASSWORD missing)" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, to });
}
