import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable strict mode to reduce hydration warnings
  experimental: {
    // @ts-ignore - turbopack types might not be up to date
    turbopack: {
      root: process.cwd(),
    },
  } as any,
};

export default nextConfig;
