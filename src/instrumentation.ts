// Runs once when the server boots (Next.js instrumentation hook).
// Schedules the daily inventory report: checks the clock every minute and
// fires at 6:00 AM Pacific, tracking the last-sent date so a long-running
// container sends exactly one report per day. Railway keeps the process
// alive continuously, so no external cron service is needed — though the
// /api/cron/inventory-backup route still works as a manual/backup trigger.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  let lastSentDate: string | null = null;

  setInterval(async () => {
    const now = new Date();
    const pacific = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => pacific.find((p) => p.type === type)?.value ?? "";
    const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
    const hour = get("hour");

    if (hour !== "06" || lastSentDate === dateKey) return;
    lastSentDate = dateKey;

    try {
      const { sendInventoryReport } = await import("@/lib/inventoryReport");
      const result = await sendInventoryReport();
      console.log(`[daily report] ${dateKey}: sent=${result.sent} (${result.detail})`);
    } catch (err) {
      console.error("[daily report] failed:", err);
    }
  }, 60_000);

  // Check USPS-tracked orders for delivery every 30 minutes and mark delivered
  // ones Complete. Runs only if the USPS API is configured; no-ops otherwise.
  const runDeliveryCheck = async () => {
    try {
      const { checkDeliveries } = await import("@/lib/deliveries");
      const result = await checkDeliveries();
      if (result.delivered > 0) console.log(`[delivery check] ${result.detail}`);
    } catch (err) {
      console.error("[delivery check] failed:", err);
    }
  };
  setTimeout(runDeliveryCheck, 60_000); // once shortly after boot
  setInterval(runDeliveryCheck, 30 * 60_000);
}
