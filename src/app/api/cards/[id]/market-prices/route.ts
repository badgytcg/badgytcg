import { NextResponse } from "next/server";
import { getMarketPrices } from "@/lib/marketPrices";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prices = await getMarketPrices(id);
  return NextResponse.json({ prices });
}
