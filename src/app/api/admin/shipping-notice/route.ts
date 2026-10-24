import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const row = await prisma.shippingNotice.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    active: row?.active ?? false,
    message: row?.message ?? "",
    resumeDate: row?.resumeDate ? row.resumeDate.toISOString().slice(0, 10) : "",
  });
}

// PUT — set the notice. Body: { active, message, resumeDate? (YYYY-MM-DD) }
export async function PUT(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const active = !!body?.active;
  const message = String(body?.message ?? "").trim();
  const resumeDate = body?.resumeDate ? new Date(String(body.resumeDate)) : null;

  if (active && !message) {
    return NextResponse.json({ error: "Add a message buyers will see before turning the notice on." }, { status: 400 });
  }

  const data = {
    active,
    message,
    resumeDate: resumeDate && !isNaN(resumeDate.getTime()) ? resumeDate : null,
  };
  const row = await prisma.shippingNotice.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "shipping_notice.update",
    detail: active ? `Shipping notice ON: "${message}"${data.resumeDate ? ` (resume ${data.resumeDate.toISOString().slice(0, 10)})` : ""}` : "Shipping notice OFF",
    request,
  });

  return NextResponse.json({
    active: row.active,
    message: row.message,
    resumeDate: row.resumeDate ? row.resumeDate.toISOString().slice(0, 10) : "",
  });
}
