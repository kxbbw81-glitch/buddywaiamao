import type { NextConfig } from 'next'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined

// 修复说明：[中危-安全配置]，原因：缺少安全响应头（可被任意 iframe 点击劫持、MIME 嗅探等）；补充基础安全头并显式开启 reactStrictMode。
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  ...(basePath ? { basePath } : {}),
}

export default nextConfig
