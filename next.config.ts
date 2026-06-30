import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ocg-card-catalog.s3.us-west-2.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        // Applies site-wide. /admin is the highest-value target (price/stock
        // mutation, customer order data) so framing/sniffing protection
        // matters most there, but there's no downside to it everywhere.
        source: "/:path*",
        headers: [
          // Blocks the whole site from being framed by another origin —
          // the standard defense against clickjacking an admin into
          // clicking a disguised button.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from guessing content types in a way that can
          // turn an upload into executable script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak full referrer URLs (which can carry session-ish
          // query params) to third-party destinations.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force HTTPS for a year, including subdomains, once a browser
          // has seen this once — protects the Google OAuth + session
          // cookie flow from being downgraded to plain HTTP.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Disable browser features this site never uses.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
