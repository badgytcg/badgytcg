import { NextResponse } from "next/server";
import { getEffectiveCards } from "@/lib/catalog";

export async function GET() {
  const cards = await getEffectiveCards();
  return NextResponse.json({ cards });
}
