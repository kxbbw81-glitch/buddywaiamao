import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 修复说明：[P0-子路径发布]，原因：/new 下发布时未设置 basePath 会让 Next 静态资源和路由落到根路径，与现有站点冲突。
  basePath: "/new",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost', '0.0.0.0'],
};

export default nextConfig;
