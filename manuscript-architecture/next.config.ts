import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep Prisma out of the bundler (engine binary tracing) — recommended for production builds
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  agentRules: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
