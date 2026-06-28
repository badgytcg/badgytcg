import { NextResponse } from "next/server";
import { getMarketOverview } from "@/lib/marketOverview";

export async function GET() {
  const overview = await getMarketOverview();
  return NextResponse.json(overview);
}
