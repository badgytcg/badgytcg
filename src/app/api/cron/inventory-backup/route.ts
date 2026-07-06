import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, adminAlertEmail } from "@/lib/email";

// Secured by CRON_SECRET env var.
// Call this daily from Railway's cron job or cron-job.org:
//   GET https://your-site.com/api/cron/inventory-backup
//   Header: x-cron-secret: <CRON_SECRET>
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overrides = await prisma.cardOverride.findMany({
    orderBy: { cardId: "asc" },
  });

  if (overrides.length === 0) {
    return NextResponse.json({ ok: true, message: "No overrides to back up." });
  }

  // Build CSV: cardId,price,stock
  const rows = ["cardId,price,stock"];
  for (const o of overrides) {
    rows.push(`${csvEscape(o.cardId)},${o.price},${o.stock}`);
  }
  const csv = rows.join("\n");

  const to = adminAlertEmail();
  if (!to) {
    console.warn("[backup] No admin email configured — skipping email.");
    return NextResponse.json({ ok: true, skipped: "no admin email" });
  }

  const date = new Date().toISOString().slice(0, 10);
  const sent = await sendEmail({
    to,
    subject: `[BadgyTCG] Inventory Backup — ${date}`,
    text: [
      `Daily inventory snapshot for ${date}.`,
      `${overrides.length} card override(s) attached as CSV.`,
      "",
      "To restore: go to /admin/inventory → Restore Backup → upload this CSV.",
      "",
      "--- CSV preview (first 5 rows) ---",
      rows.slice(0, 6).join("\n"),
    ].join("\n"),
    attachments: [
      {
        filename: `badgy-inventory-${date}.csv`,
        content: csv,
        contentType: "text/csv",
      },
    ],
  });

  return NextResponse.json({ ok: true, sent, rows: overrides.length, date });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
