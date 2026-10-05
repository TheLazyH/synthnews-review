import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/read/:path*", destination: "/review/:path*", permanent: false },
      { source: "/lists/:slug", destination: "/review/pairs/:slug", permanent: false },
    ];
  },
};

export default nextConfig;
