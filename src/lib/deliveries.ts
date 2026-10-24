import { prisma } from "@/lib/prisma";
import { getUspsStatus } from "@/lib/usps";

// Check USPS-tracked orders that are on their way and flip any that the carrier
// now reports delivered to status "delivered" (shown as Complete). Only touches
// USPS shipments — other carriers are marked delivered by hand. Safe to run on
// a schedule; it ignores already-delivered/cancelled/refunded orders and never
// throws out of the loop (one bad lookup won't stop the rest).
export async function checkDeliveries(): Promise<{ checked: number; delivered: number; detail: string }> {
  if (!process.env.USPS_CLIENT_ID || !process.env.USPS_CLIENT_SECRET) {
    return { checked: 0, delivered: 0, detail: "USPS API not configured" };
  }

  const candidates = await prisma.order.findMany({
    where: {
      trackingCarrier: "usps",
      trackingNumber: { not: null },
      deliveredAt: null,
      status: { in: ["paid", "fulfilled"] },
    },
    select: { id: true, trackingNumber: true },
  });

  let delivered = 0;
  for (const order of candidates) {
    const status = await getUspsStatus(order.trackingNumber!);
    if (!status) continue; // couldn't reach USPS for this one — try again next run
    if (status.delivered) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "delivered", deliveredAt: new Date() },
      });
      delivered++;
    }
  }

  return {
    checked: candidates.length,
    delivered,
    detail: `Checked ${candidates.length} USPS shipment(s); ${delivered} newly delivered`,
  };
}
