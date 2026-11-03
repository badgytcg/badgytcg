import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  void req;
  // Public showcase = your own starter/meta decks only. "via Vibes Decks"
  // imports (type "vibes") are surfaced on card pages, not the homepage.
  const decks = await prisma.featuredDeck.findMany({
    where: { active: true, NOT: { type: "vibes" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ decks });
}
