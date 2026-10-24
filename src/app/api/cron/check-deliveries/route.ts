import { NextResponse } from "next/server";
import { checkDeliveries } from "@/lib/deliveries";

// Manual/backup trigger for the USPS delivery check (the primary schedule is
// the in-app timer in src/instrumentation.ts). Secured by CRON_SECRET:
//   GET https://your-site.com/api/cron/check-deliveries
//   Header: x-cron-secret: <CRON_SECRET>
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await checkDeliveries();
  return NextResponse.json({ ok: true, ...result });
}
