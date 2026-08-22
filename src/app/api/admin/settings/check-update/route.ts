import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getVersion, loadVerifiedManifest, compareVersions } from '@/lib/update-manager'
import { beginBackup } from '@/lib/db-maintenance'

/**
 * POST /api/admin/settings/check-update
 *   - 拉取镜像源 manifest.json，解析 latestVersion + changelog
 *   - SHA256 + 可选 RSA 签名校验
 *   - 有更新时触发更新前自动备份
 *   - 写入 SystemMirror（lastCheckedAt/lastKnownVersion/lastManifestSha256/lastSignatureValid/lastChangelog/lastBackupFile/lastBackupAt）
 *   - 仅超管
 */
export async function POST() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const mirror = await db.systemMirror.findUnique({ where: { id: '1' } })
    const mirrorUrl = mirror?.url || ''
    const currentVersion = getVersion()
    const loaded = await loadVerifiedManifest(mirrorUrl)

    let latest = currentVersion
    let changelog = ''
    let sha256 = ''
    let signatureValid: boolean | null = null
    let status: 'up_to_date' | 'update_available' | 'check_failed' = 'up_to_date'
    let errorMsg = ''

    if (loaded.ok && loaded.manifest) {
      latest = loaded.manifest.latestVersion
      changelog = loaded.manifest.changelog || ''
      sha256 = loaded.sha256 || ''
      signatureValid = loaded.signatureValid
      status = compareVersions(latest, currentVersion) > 0 ? 'update_available' : 'up_to_date'
    } else {
      errorMsg = loaded.error || '未配置镜像源，无法检查'
      status = 'check_failed'
    }

    const now = new Date()
    let backupFile = mirror?.lastBackupFile || ''
    let backupAt = mirror?.lastBackupAt

    // 有更新时触发更新前自动备份
    if (status === 'update_available') {
      try {
        const backup = await beginBackup({ actorId: auth.user.id })
        backupFile = backup.fileName
        backupAt = new Date()
      } catch (e) {
        console.error('[check-update] auto backup failed:', e)
      }
    }

    await db.systemMirror.upsert({
      where: { id: '1' },
      create: {
        id: '1', url: mirrorUrl, lastCheckedAt: now, lastKnownVersion: latest,
        lastManifestSha256: sha256, lastSignatureValid: signatureValid,
        lastChangelog: changelog, lastBackupFile: backupFile, lastBackupAt: backupAt,
        updatedById: auth.user.id,
      },
      update: {
        lastCheckedAt: now, lastKnownVersion: latest,
        lastManifestSha256: sha256, lastSignatureValid: signatureValid,
        lastChangelog: changelog, lastBackupFile: backupFile, lastBackupAt: backupAt,
        updatedById: auth.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        currentVersion,
        latestVersion: latest,
        lastCheckedAt: now.toISOString(),
        status,
        changelog,
        signatureValid,
        backupFile,
        ...(errorMsg ? { error: errorMsg } : {}),
      },
    })
  } catch (error) {
    console.error('[admin/settings/check-update POST]', error)
    return NextResponse.json({ success: false, error: '检查更新失败' }, { status: 500 })
  }
}
