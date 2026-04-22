import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["xlsx-js-style"],

  // Disable webpack filesystem cache — fixes ENOENT rename errors
  // caused by spaces in the OneDrive project path on Windows
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
