import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getEffectiveCards } from "@/lib/catalog";
import { findCardByAnyName } from "@/lib/inventory";

const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(value: string): value is MediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { image, mediaType } = await request.json();
  if (typeof image !== "string" || typeof mediaType !== "string" || !isValidMediaType(mediaType)) {
    return NextResponse.json({ error: "Expected { image: base64, mediaType: image/jpeg|png|webp|gif }" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          {
            type: "text",
            text:
              "This is a photo of a Vibes TCG trading card. Read the card's name exactly as printed " +
              "in the title bar near the top. Respond with ONLY the card name text, nothing else — " +
              "no quotes, no explanation. If you can't read a name at all, respond with exactly: UNKNOWN",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

  if (!rawText || rawText.toUpperCase() === "UNKNOWN") {
    return NextResponse.json({ rawText, card: null });
  }

  const catalog = await getEffectiveCards();
  const card = findCardByAnyName(rawText, catalog);

  return NextResponse.json({ rawText, card: card ?? null });
}
