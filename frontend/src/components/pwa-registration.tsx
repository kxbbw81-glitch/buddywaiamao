'use client'

import { useEffect } from 'react'

// CRM 页面默认不缓存业务 API 响应，避免离线缓存保存会话或客户数据。
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    void navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath}/` }).catch(() => undefined)
  }, [])
  return null
}
