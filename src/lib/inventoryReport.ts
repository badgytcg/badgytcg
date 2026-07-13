import { prisma } from "@/lib/prisma";
import { getEffectiveCards, listStockedVariants, listSpecialCards } from "@/lib/catalog";
import { sendEmail, adminAlertEmail } from "@/lib/email";

function csvEscape(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Builds and emails the full daily inventory report:
 *  - full-report CSV: every card/foil/special with name, set, rarity, price,
 *    stock, owner, and line value — for human review
 *  - backup CSV: cardId,price,stock — restorable via /admin/inventory
 * Returns true if the email actually went out. */
export async function sendInventoryReport(): Promise<{ sent: boolean; detail: string }> {
  const to = adminAlertEmail();
  if (!to) return { sent: false, detail: "no admin email configured" };

  const [cards, variants, specials, overrides] = await Promise.all([
    getEffectiveCards(),
    listStockedVariants(),
    listSpecialCards(),
    prisma.cardOverride.findMany({ orderBy: { cardId: "asc" } }),
  ]);
  const ownerByCardId = new Map(overrides.map((o) => [o.cardId, o.owner]));

  const all = [...cards, ...variants, ...specials];
  const header = "Name,Set,Rarity,Type,Price,Stock,Owner,Line Value";
  const rows = [header];
  let totalValue = 0;
  let totalUnits = 0;
  let inStockLines = 0;

  for (const c of all) {
    const owner = ownerByCardId.get(c.id) ?? "badgy";
    const lineValue = c.price * c.stock;
    totalValue += lineValue;
    totalUnits += c.stock;
    if (c.stock > 0) inStockLines++;
    rows.push(
      [
        csvEscape(c.name),
        csvEscape(c.set),
        csvEscape(c.rarity),
        csvEscape(c.isFoil ? "Foil" : c.isSpecial ? "Special" : "Single"),
        c.price.toFixed(2),
        c.stock,
        csvEscape(owner),
        lineValue.toFixed(2),
      ].join(",")
    );
  }

  // Restore-compatible backup (cardId,price,stock), same format the
  // /admin/inventory Restore Backup upload expects.
  const backupRows = ["cardId,price,stock", ...overrides.map((o) => `${csvEscape(o.cardId)},${o.price},${o.stock}`)];

  const date = new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
  const isoDate = new Date().toISOString().slice(0, 10);

  const sent = await sendEmail({
    to,
    subject: `[BadgyTCG] Daily Inventory Report — ${date}`,
    text: [
      `Daily inventory report for ${date}.`,
      "",
      `Total inventory value: $${totalValue.toFixed(2)}`,
      `Total units in stock:  ${totalUnits}`,
      `Listings with stock:   ${inStockLines} of ${all.length}`,
      "",
      "Attached:",
      `- badgy-inventory-report-${isoDate}.csv — full report (name, set, price, stock, owner)`,
      `- badgy-inventory-backup-${isoDate}.csv — restore file (upload at /admin/inventory → Restore Backup)`,
    ].join("\n"),
    attachments: [
      {
        filename: `badgy-inventory-report-${isoDate}.csv`,
        content: rows.join("\n"),
        contentType: "text/csv",
      },
      {
        filename: `badgy-inventory-backup-${isoDate}.csv`,
        content: backupRows.join("\n"),
        contentType: "text/csv",
      },
    ],
  });

  return { sent, detail: `${all.length} listings, $${totalValue.toFixed(2)} total value` };
}
