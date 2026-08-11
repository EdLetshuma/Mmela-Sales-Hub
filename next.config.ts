import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["xlsx-js-style"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  webpack: (config, { dev }) => {
    if (dev) { config.cache = false; }
    return config;
  },
};
export default nextConfig;
