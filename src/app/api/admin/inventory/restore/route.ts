import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

// Accepts the backup CSV (cardId,price,stock) and upserts every row.
export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const text = await request.text();
  const lines = text.trim().split(/\r?\n/);

  // Allow an optional header row
  const dataLines = lines[0]?.toLowerCase().startsWith("cardid") ? lines.slice(1) : lines;

  const parsed: Array<{ cardId: string; price: number; stock: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    const parts = parseCsvLine(line);
    if (parts.length < 3) {
      errors.push(`Row ${i + 2}: expected 3 columns, got ${parts.length}`);
      continue;
    }
    const [cardId, rawPrice, rawStock] = parts;
    const price = parseFloat(rawPrice);
    const stock = parseInt(rawStock, 10);
    if (!cardId || isNaN(price) || isNaN(stock)) {
      errors.push(`Row ${i + 2}: invalid data — ${line}`);
      continue;
    }
    parsed.push({ cardId, price, stock });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "No valid rows found.", errors }, { status: 400 });
  }

  // Upsert all in a single transaction
  await prisma.$transaction(
    parsed.map((row) =>
      prisma.cardOverride.upsert({
        where: { cardId: row.cardId },
        create: { cardId: row.cardId, price: row.price, stock: row.stock },
        update: { price: row.price, stock: row.stock },
      })
    )
  );

  await logAdminAction({
    adminEmail: session!.user!.email!,
    action: "inventory.restore_backup",
    detail: `Restored ${parsed.length} card overrides from CSV upload`,
    request,
  });

  return NextResponse.json({ ok: true, restored: parsed.length, errors });
}

// Minimal CSV parser — handles quoted fields with commas inside.
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}
