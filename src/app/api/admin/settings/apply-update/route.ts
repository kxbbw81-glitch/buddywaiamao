import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getVersion, loadVerifiedManifest, compareVersions } from '@/lib/update-manager'
import { beginBackup } from '@/lib/db-maintenance'

/**
 * POST /api/admin/settings/apply-update
 *   - 验证镜像源有可用更新
 *   - 更新前自动备份数据库
 *   - 返回目标版本 + 备份信息（实际代码替换需通过部署脚本执行 + 重启服务）
 *   - 仅超管
 */
export async function POST() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const mirror = await db.systemMirror.findUnique({ where: { id: '1' } })
    const currentVersion = getVersion()
    const loaded = await loadVerifiedManifest(mirror?.url || '')

    if (!loaded.ok || !loaded.manifest) {
      return NextResponse.json({ success: false, error: loaded.error || '无法加载 manifest' }, { status: 400 })
    }
    if (compareVersions(loaded.manifest.latestVersion, currentVersion) <= 0) {
      return NextResponse.json({ success: false, error: '当前已是最新版本，无需更新' }, { status: 400 })
    }

    // 更新前自动备份
    const backup = await beginBackup({ actorId: auth.user.id })

    return NextResponse.json({
      success: true,
      data: {
        currentVersion,
        targetVersion: loaded.manifest.latestVersion,
        backupFile: backup.fileName,
        jobId: backup.id,
        message: '已创建更新前数据库备份。实际应用更新包（替换代码 + 重启服务）需通过部署脚本执行。',
      },
    })
  } catch (error) {
    console.error('[admin/settings/apply-update POST]', error)
    return NextResponse.json({ success: false, error: '应用更新失败' }, { status: 500 })
  }
}
