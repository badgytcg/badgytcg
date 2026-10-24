// USPS tracking via the current USPS APIs platform (apis.usps.com), OAuth2
// client-credentials. Set USPS_CLIENT_ID and USPS_CLIENT_SECRET (from a USPS
// developer account with the Tracking API enabled). USPS_API_BASE can point at
// the test environment (https://apis-tem.usps.com) if ever needed.
//
// We only need one bit of truth: has the carrier marked this package delivered?

const BASE = process.env.USPS_API_BASE ?? "https://apis.usps.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.USPS_CLIENT_ID;
  const secret = process.env.USPS_CLIENT_SECRET;
  if (!id || !secret) return null;

  // Reuse a cached token until ~1 min before it expires.
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const res = await fetch(`${BASE}/oauth2/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!res.ok) {
    console.error("[usps] token request failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const token = data.access_token as string | undefined;
  const expiresIn = Number(data.expires_in) || 3600;
  if (!token) return null;
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export interface UspsStatus {
  delivered: boolean;
  status: string; // human-readable status text, best-effort
}

/** Query USPS for a tracking number. Returns null when USPS can't be reached
 * or isn't configured (caller should simply try again later), or a status with
 * `delivered` set once the package shows as delivered. Never throws. */
export async function getUspsStatus(trackingNumber: string): Promise<UspsStatus | null> {
  try {
    const token = await getToken();
    if (!token) return null;

    const res = await fetch(
      `${BASE}/tracking/v3/tracking/${encodeURIComponent(trackingNumber.trim())}?expand=SUMMARY`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    if (res.status === 401) { cachedToken = null; return null; } // token went stale
    if (!res.ok) return null;

    const data = await res.json();
    // The response shape has shifted across USPS API revisions; pull the status
    // text from whichever field is present, then detect "delivered" loosely.
    const statusText = String(
      data.status ?? data.statusCategory ?? data.statusSummary ?? data.trackingEvents?.[0]?.eventType ?? ""
    );
    const blob = JSON.stringify(data).toLowerCase();
    const delivered = /\bdelivered\b/.test(statusText.toLowerCase()) || /"[^"]*delivered[^"]*"/.test(blob);
    return { delivered, status: statusText || (delivered ? "Delivered" : "In transit") };
  } catch (err) {
    console.error("[usps] tracking lookup failed:", err);
    return null;
  }
}
