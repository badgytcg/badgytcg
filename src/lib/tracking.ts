// Shipment carriers we can build a "track this package" link for.
export const CARRIERS = [
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "other", label: "Other" },
] as const;

export type CarrierValue = (typeof CARRIERS)[number]["value"];

export function carrierLabel(carrier: string | null | undefined): string {
  return CARRIERS.find((c) => c.value === carrier)?.label ?? "Carrier";
}

// Returns a public tracking URL for a number, or null when we can't link it
// (unknown/"other" carrier) — in that case just show the number.
export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  if (!number) return null;
  const n = encodeURIComponent(number.trim());
  switch (carrier) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    default:
      return null;
  }
}
