import { NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/marketPrices";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await getPriceHistory(id);
  return NextResponse.json({ history });
}
