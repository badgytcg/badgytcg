import { NextResponse } from "next/server";
import { getEffectiveCardById } from "@/lib/catalog";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getEffectiveCardById(id);
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ card });
}
