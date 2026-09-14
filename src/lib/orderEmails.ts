import { sendEmail } from "@/lib/email";
import { carrierLabel, trackingUrl } from "@/lib/tracking";

interface EmailItem {
  cardName: string;
  qty: number;
}

function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0] : "there";
}

// ⚡ Order confirmation — "Option 3" hype tone. Sent when payment completes.
export async function sendOrderConfirmation(opts: {
  to: string;
  name: string | null;
  orderId: string;
  items: EmailItem[];
  totalCents: number;
  shipCity?: string | null;
  shipState?: string | null;
  shipPostal?: string | null;
}): Promise<boolean> {
  const itemLines = opts.items.map((i) => `🃏 ${i.qty}x ${i.cardName}`);
  const dest = [opts.shipCity, opts.shipState].filter(Boolean).join(", ") + (opts.shipPostal ? ` ${opts.shipPostal}` : "");
  return sendEmail({
    to: opts.to,
    subject: `LET'S GO — your BadgyTCG order is in! ⚡🐧`,
    text: [
      `What's up ${firstName(opts.name)},`,
      "",
      "Your order's locked in and we're hyped to get these to you! 🔥",
      "",
      ...itemLines,
      `💰 Total: $${(opts.totalCents / 100).toFixed(2)}`,
      "",
      dest.trim() ? `📦 Heading to: ${dest.trim()}` : "",
      "",
      "Tracking drops in your inbox the second it ships. Thanks for repping the vibe! 🐧",
      "",
      "— Team BadgyTCG",
      "badgytcg.com",
    ].filter((l) => l !== null).join("\n"),
  });
}

// 📦 Shipped notification with tracking — matching hype tone. Sent when an
// admin adds a tracking number to an order.
export async function sendShippedEmail(opts: {
  to: string;
  name: string | null;
  items: EmailItem[];
  trackingNumber: string;
  trackingCarrier: string | null;
}): Promise<boolean> {
  const url = trackingUrl(opts.trackingCarrier, opts.trackingNumber);
  const itemLines = opts.items.map((i) => `🃏 ${i.qty}x ${i.cardName}`);
  return sendEmail({
    to: opts.to,
    subject: `📦 Your BadgyTCG order shipped! Track it here ⚡`,
    text: [
      `What's up ${firstName(opts.name)},`,
      "",
      "Great news — your order is on the way! 🚚🐧",
      "",
      `📦 ${carrierLabel(opts.trackingCarrier)} tracking: ${opts.trackingNumber}`,
      url ? `🔗 Track it: ${url}` : "",
      "",
      ...itemLines,
      "",
      "Thanks for repping the vibe! 🐧",
      "— Team BadgyTCG",
      "badgytcg.com",
    ].filter((l) => l !== null && l !== "").join("\n"),
  });
}
