import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The scraper/seed modules (cheerio, fs) are scripts-only and never bundled into the app.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
