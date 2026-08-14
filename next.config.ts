import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["21.0.22.72", "preview-chat-1302553a-e77c-4de3-bed3-b21c403a3786.space-z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

};

export default nextConfig;
