import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')
const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')
const KEEP_BACKUPS = 7 // 保留最近 7 份，超期自动清理

/** 授权码：环境变量 DB_MAINT_TOKEN 配置后强制校验；未配置时接受任意非空授权码 */
function checkToken(token: unknown): boolean {
  const envToken = process.env.DB_MAINT_TOKEN
  if (envToken) return token === envToken
  return typeof token === 'string' && token.trim().length > 0
}

/**
 * GET /api/admin/db/maintenance
 * 数据库状态：核心表行数 + 备份列表（仅超级管理员）
 */
export async function GET() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response

  const tables = ['User', 'Customer', 'Inquiry', 'Quotation', 'Order', 'Payment', 'Product', 'Sample', 'Activity', 'Approval']
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

  return NextResponse.json({ success: true, data: { counts, backups, keepBackups: KEEP_BACKUPS } })
}

/**
 * POST /api/admin/db/maintenance  body: { action: 'backup', token: string }
 * 创建 SQLite 备份（文件级复制），保留策略：最近 7 份，超期自动清理
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (body?.action !== 'backup') {
    return NextResponse.json({ success: false, error: '未知的维护操作' }, { status: 400 })
  }
  if (!checkToken(body.token)) {
    return NextResponse.json({ success: false, error: '数据库维护授权码不正确' }, { status: 403 })
  }

  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
    const now = new Date()
    const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(
      now.getHours()
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const name = `nexfab-backup-${stamp}.db`
    await fs.copyFile(DB_PATH, path.join(BACKUP_DIR, name))

    // 保留策略：只保留最近 KEEP_BACKUPS 份
    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith('.db'))
    if (files.length > KEEP_BACKUPS) {
      const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(BACKUP_DIR, f))).mtimeMs })))
      const toDelete = stats.sort((a, b) => b.t - a.t).slice(KEEP_BACKUPS)
      await Promise.all(toDelete.map((s) => fs.unlink(path.join(BACKUP_DIR, s.f))))
    }

    const st = await fs.stat(path.join(BACKUP_DIR, name))
    return NextResponse.json({
      success: true,
      data: { name, size: st.size, kept: Math.min(files.length + 1, KEEP_BACKUPS) },
    })
  } catch (error) {
    console.error('DB backup error:', error)
    return NextResponse.json({ success: false, error: '创建备份失败' }, { status: 500 })
  }
}
