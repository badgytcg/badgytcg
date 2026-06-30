// In-memory sliding-window rate limiter. Single-instance only (resets on
// deploy/restart) — fine for this app's scale and traffic. It's a defense-
// in-depth layer for admin mutation endpoints: even with a valid admin
// session, a compromised token or buggy client shouldn't be able to hammer
// price/stock changes or spam customer emails at unlimited speed.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  hits.set(key, timestamps);

  // Keep the map from growing unbounded over a long-running process.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
  }

  return timestamps.length > limit;
}

export function clientKeyFor(request: Request, prefix: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${prefix}:${ip}`;
}
