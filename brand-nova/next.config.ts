import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled for the browser.
  serverExternalPackages: ["cheerio"],
};

export default nextConfig;
