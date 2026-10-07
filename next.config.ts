import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.18"],
  async redirects() {
    return [
      { source: "/read/:path*", destination: "/review/:path*", permanent: false },
      { source: "/lists/:slug", destination: "/review/pairs/:slug", permanent: false },
    ];
  },
};

export default nextConfig;
