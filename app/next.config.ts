import type { NextConfig } from "next";

const ROUTER_CACHE_SECONDS = 60 * 60;

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: ROUTER_CACHE_SECONDS,
      static: ROUTER_CACHE_SECONDS,
    },
  },
};

export default nextConfig;
