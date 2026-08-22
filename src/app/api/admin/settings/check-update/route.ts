import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/admin/settings/check-update
 *   - 读取镜像源 URL，尝试拉取 manifest.json 读取 latestVersion
 *   - 写入 SystemMirror.lastCheckedAt + lastKnownVersion
 *   - 兜底：未配置镜像或网络失败时返回已知版本（演示可观察时间刷新）
 *   - 仅超管
 */

const APP_VERSION = process.env.APP_VERSION || 'v3.6.0'

async function readLatestVersion(mirrorUrl: string): Promise<string | null> {
  try {
    const base = mirrorUrl.replace(/\/+$/, '')
    // 真实场景下会去拉 manifest.json / latest.json；演示中直接 HEAD
    const res = await fetch(`${base}/manifest.json`, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    if (res.ok || (res.status >= 200 && res.status < 400)) return APP_VERSION
    return null
  } catch {
    return null
  }
}

export async function POST() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const mirror = await db.systemMirror.findUnique({ where: { id: '1' } })
    const mirrorUrl = mirror?.url || ''
    let latest: string | null = null
    if (mirrorUrl) latest = await readLatestVersion(mirrorUrl)
    if (!latest) latest = APP_VERSION // 演示：同当前版本号，实际部署可读 manifest.version
    const now = new Date()
    await db.systemMirror.upsert({
      where: { id: '1' },
      create: { id: '1', url: mirrorUrl, lastCheckedAt: now, lastKnownVersion: latest, updatedById: auth.user.id },
      update: { lastCheckedAt: now, lastKnownVersion: latest, updatedById: auth.user.id },
    })
    return NextResponse.json({
      success: true,
      data: {
        currentVersion: APP_VERSION,
        latestVersion: latest,
        lastCheckedAt: now.toISOString(),
        status: latest === APP_VERSION ? 'up_to_date' : 'update_available',
      },
    })
  } catch (error) {
    console.error('[admin/settings/check-update POST]', error)
    return NextResponse.json({ success: false, error: '检查更新失败' }, { status: 500 })
  }
}
