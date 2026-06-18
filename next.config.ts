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
};

export default nextConfig;
