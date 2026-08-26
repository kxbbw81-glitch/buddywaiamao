import type { Metadata, Viewport } from 'next'
import { PwaRegistration } from '@/components/pwa-registration'
import './globals.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

export const metadata: Metadata = {
  title: 'NexFab AI 外贸 CRM',
  description: 'NexFab AI 外贸 CRM V2.0 正式前端基础平台',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: { icon: `${basePath}/icons/nexfab-icon.svg`, apple: `${basePath}/icons/nexfab-icon.svg` },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#185fa5' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><PwaRegistration />{children}</body>
    </html>
  )
}
