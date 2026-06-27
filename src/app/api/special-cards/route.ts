import { NextResponse } from "next/server";
import { listSpecialCards } from "@/lib/catalog";

export async function GET() {
  const cards = await listSpecialCards();
  return NextResponse.json({ cards });
}
