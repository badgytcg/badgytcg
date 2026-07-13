import { NextResponse } from "next/server";
import { sendInventoryReport } from "@/lib/inventoryReport";

// Manual/backup trigger for the daily inventory report (the primary
// schedule is the in-app 6 AM Pacific timer in src/instrumentation.ts).
// Secured by CRON_SECRET env var:
//   GET https://your-site.com/api/cron/inventory-backup
//   Header: x-cron-secret: <CRON_SECRET>
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendInventoryReport();
  return NextResponse.json({ ok: true, ...result });
}
