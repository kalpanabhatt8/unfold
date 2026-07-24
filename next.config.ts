import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/terms",
        destination: "/terms-and-conditions",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
