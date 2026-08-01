import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d1s8s7aw8vf5zu.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
