import { prisma } from "@/lib/prisma";

// Fire-and-forget audit trail for admin mutations. Never throws — a logging
// failure should never block the actual admin action from completing.
export async function logAdminAction(opts: {
  adminEmail: string;
  action: string;
  detail: string;
  request?: Request;
}): Promise<void> {
  try {
    const ip = opts.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await prisma.adminAuditLog.create({
      data: { adminEmail: opts.adminEmail, action: opts.action, detail: opts.detail, ip },
    });
  } catch (err) {
    console.error("[audit log] failed to record:", err);
  }
}
