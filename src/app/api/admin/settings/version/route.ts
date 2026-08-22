import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/admin/settings/version
 *   - 当前版本（常量注入）+ 上次检查的最新版本（来自 SystemMirror 行）
 *   - 仅超管
 */

const APP_VERSION = process.env.APP_VERSION || 'v3.6.0'

export async function GET() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const mirror = await db.systemMirror.findUnique({ where: { id: '1' } })
    return NextResponse.json({
      success: true,
      data: {
        currentVersion: APP_VERSION,
        latestVersion: mirror?.lastKnownVersion || '',
        lastCheckedAt: mirror?.lastCheckedAt || null,
      },
    })
  } catch (error) {
    console.error('[admin/settings/version GET]', error)
    return NextResponse.json({ success: false, error: '读取版本信息失败' }, { status: 500 })
  }
}
