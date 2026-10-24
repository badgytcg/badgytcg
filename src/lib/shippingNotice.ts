import { prisma } from "@/lib/prisma";

export interface ShippingNoticeData {
  active: boolean;
  message: string;
  resumeDate: string | null;
}

// The single shipping-notice row (id "default"); defaults to inactive when the
// row doesn't exist yet. Never throws — a DB hiccup just means "no notice".
export async function getShippingNotice(): Promise<ShippingNoticeData> {
  try {
    const row = await prisma.shippingNotice.findUnique({ where: { id: "default" } });
    if (!row || !row.active) return { active: false, message: row?.message ?? "", resumeDate: row?.resumeDate?.toISOString() ?? null };
    return { active: true, message: row.message, resumeDate: row.resumeDate?.toISOString() ?? null };
  } catch {
    return { active: false, message: "", resumeDate: null };
  }
}

// One-line plain-text version for order confirmation emails, or "" when off.
export function shippingNoticeLine(notice: ShippingNoticeData): string {
  if (!notice.active) return "";
  const base = notice.message?.trim() || "Shipping is temporarily delayed.";
  if (notice.resumeDate) {
    const d = new Date(notice.resumeDate).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
    return `${base} Orders will begin shipping again around ${d}.`;
  }
  return base;
}
