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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Scanner isn't configured (ANTHROPIC_API_KEY missing).", card: null }, { status: 503 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let response;
  try {
    response = await anthropic.messages.create({
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
                "This image is cropped to a single Vibes TCG trading card. Read the card's name exactly " +
                "as printed in the title bar near the top of the card. Respond with ONLY the card name " +
                "text — no quotes, no punctuation you don't see, no explanation. If the card is blurry, " +
                "cut off, or you can't clearly read the title, respond with exactly: UNKNOWN",
            },
          ],
        },
      ],
    });
  } catch (err) {
    // Surface the real reason (bad key, no credit, rate limit, model error)
    // instead of a silent 500 the scanner swallows.
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[scan] Anthropic call failed:", msg);
    return NextResponse.json({ error: `Recognition failed: ${msg}`, card: null }, { status: 502 });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

  if (!rawText || rawText.toUpperCase() === "UNKNOWN") {
    return NextResponse.json({ rawText, card: null });
  }

  const catalog = await getEffectiveCards();
  const card = findCardByAnyName(rawText, catalog);

  return NextResponse.json({ rawText, card: card ?? null });
}
