import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { beginBackup, listMaintenanceLogs, checkDbMaintToken, KEEP_BACKUPS } from '@/lib/db-maintenance'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

/**
 * GET /api/admin/db/maintenance
 * 数据库状态：核心表行数 + 备份列表 + 维护历史（仅超管）
 */
export async function GET() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response

  const tables = ['User', 'Customer', 'Inquiry', 'Quotation', 'Order', 'Payment', 'Product', 'Sample', 'Activity', 'Approval', 'Team', 'PermissionTemplate', 'MaintenanceLog']
  const counts: Record<string, number> = {}
  for (const t of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      counts[t] = await (db as any)[t[0].toLowerCase() + t.slice(1)].count()
    } catch {
      counts[t] = 0
    }
  }

  let backups: { name: string; size: number; mtime: string }[] = []
  try {
    const files = await fs.readdir(BACKUP_DIR)
    const stats = await Promise.all(
      files.filter((f) => f.endsWith('.db')).map(async (f) => {
        const st = await fs.stat(path.join(BACKUP_DIR, f))
        return { name: f, size: st.size, mtime: st.mtime.toISOString() }
      })
    )
    backups = stats.sort((a, b) => b.mtime.localeCompare(a.mtime))
  } catch {
    backups = []
  }

  const maintenanceLogs = await listMaintenanceLogs(30)

  return NextResponse.json({ success: true, data: { counts, backups, keepBackups: KEEP_BACKUPS, maintenanceLogs } })
}

/**
 * POST /api/admin/db/maintenance  body: { action: 'backup', token: string }
 * 创建 SQLite 备份（文件级复制 + SHA256 + 保留 7 份），写 MaintenanceLog
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (body?.action !== 'backup') {
    return NextResponse.json({ success: false, error: '未知的维护操作（当前仅支持 backup）' }, { status: 400 })
  }
  if (!checkDbMaintToken(body.token)) {
    return NextResponse.json({ success: false, error: '数据库维护授权码不正确或未配置 DB_MAINT_TOKEN' }, { status: 403 })
  }

  try {
    const { id, fileName } = await beginBackup({ actorId: auth.user.id })
    return NextResponse.json({ success: true, data: { jobId: id, fileName } })
  } catch (error) {
    console.error('DB backup error:', error)
    return NextResponse.json({ success: false, error: '创建备份失败' }, { status: 500 })
  }
}
