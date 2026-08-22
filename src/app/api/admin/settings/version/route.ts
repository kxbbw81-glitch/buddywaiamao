import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getVersion } from '@/lib/update-manager'

/**
 * GET /api/admin/settings/version
 *   - 当前版本（读 package.json version）+ 上次检查的最新版本（SystemMirror）
 *   - 仅超管
 */
export async function GET() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const mirror = await db.systemMirror.findUnique({ where: { id: '1' } })
    return NextResponse.json({
      success: true,
      data: {
        currentVersion: getVersion(),
        latestVersion: mirror?.lastKnownVersion || '',
        lastCheckedAt: mirror?.lastCheckedAt || null,
        lastSignatureValid: mirror?.lastSignatureValid ?? null,
        lastChangelog: mirror?.lastChangelog || '',
      },
    })
  } catch (error) {
    console.error('[admin/settings/version GET]', error)
    return NextResponse.json({ success: false, error: '读取版本信息失败' }, { status: 500 })
  }
}
