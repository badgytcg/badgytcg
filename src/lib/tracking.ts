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

// Validate a tracking number against the selected carrier's format, to catch
// typos before they're saved/emailed. Lenient on purpose — better to accept a
// borderline-real number than reject a valid one — but it rejects the obvious
// mistakes (too short, wrong prefix, letters where there should be digits).
export function validateTracking(
  carrier: string | null | undefined,
  number: string
): { ok: boolean; error?: string } {
  const n = number.trim().replace(/\s+/g, "");
  if (!n) return { ok: false, error: "Enter a tracking number." };

  switch (carrier) {
    case "usps":
      // Domestic: 20–22 digits. International: 2 letters + 9 digits + "US".
      if (/^\d{20,22}$/.test(n) || /^[A-Z]{2}\d{9}US$/i.test(n)) return { ok: true };
      return { ok: false, error: "That doesn't look like a USPS number (expected 20–22 digits)." };
    case "ups":
      if (/^1Z[0-9A-Z]{16}$/i.test(n)) return { ok: true };
      return { ok: false, error: "UPS numbers start with 1Z and are 18 characters." };
    case "fedex":
      if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n) || /^\d{20,22}$/.test(n)) return { ok: true };
      return { ok: false, error: "FedEx numbers are 12, 15, or 20–22 digits." };
    default: // "other" — we can't know the format; just require something plausible.
      if (n.length >= 5) return { ok: true };
      return { ok: false, error: "That tracking number looks too short." };
  }
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
