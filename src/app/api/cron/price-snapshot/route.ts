import { NextResponse } from "next/server";
import { captureDailySnapshots } from "@/lib/priceSnapshots";

// Manual/backup trigger for the daily price snapshot (primary schedule is the
// in-app 5 AM Pacific timer in src/instrumentation.ts). Secured by CRON_SECRET:
//   GET /api/cron/price-snapshot   Header: x-cron-secret: <CRON_SECRET>
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await captureDailySnapshots();
  return NextResponse.json({ ok: true, ...result });
}
