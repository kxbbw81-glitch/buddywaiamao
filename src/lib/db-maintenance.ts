import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'node:crypto'

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')
const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')
export const KEEP_BACKUPS = 7

export interface DbMaintenanceEvent {
  id: string
  at: string
  level: 'info' | 'warn' | 'error'
  stage: string
  table?: string
  message: string
}

function newEvent(
  level: DbMaintenanceEvent['level'],
  stage: string,
  message: string,
  table?: string
): DbMaintenanceEvent {
  return { id: `dbe_${randomUUID()}`, at: new Date().toISOString(), level, stage, table, message }
}

async function sha256Path(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

// ============ 备份 ============

export async function beginBackup(opts: { actorId?: string }): Promise<{ id: string; fileName: string }> {
  const now = new Date()
  const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const fileName = `nexfab-backup-${stamp}.db`

  const log = await db.maintenanceLog.create({
    data: { type: 'backup', status: 'running', phase: 'inventory', fileName, actorId: opts.actorId || null },
  })

  void executeBackup(log.id, fileName).catch(async (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    await db.maintenanceLog.update({
      where: { id: log.id },
      data: { status: 'failed', errorMessage: msg, completedAt: new Date() },
    })
  })

  return { id: log.id, fileName }
}

async function executeBackup(logId: string, fileName: string): Promise<void> {
  const events: DbMaintenanceEvent[] = []
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
    const dest = path.join(BACKUP_DIR, fileName)
    events.push(newEvent('info', 'inventory', `开始备份到 ${fileName}`))
    await db.maintenanceLog.update({ where: { id: logId }, data: { eventsJson: JSON.stringify(events) } })

    await fs.copyFile(DB_PATH, dest)
    const st = await fs.stat(dest)
    const sha = await sha256Path(dest)

    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith('.db'))
    let cleaned = 0
    if (files.length > KEEP_BACKUPS) {
      const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(BACKUP_DIR, f))).mtimeMs })))
      const toDelete = stats.sort((a, b) => b.t - a.t).slice(KEEP_BACKUPS)
      await Promise.all(toDelete.map((s) => fs.unlink(path.join(BACKUP_DIR, s.f))))
      cleaned = toDelete.length
    }
    events.push(newEvent('info', 'completed', `备份完成 ${(st.size / 1024).toFixed(1)}KB，SHA256 ${sha.slice(0, 12)}…${cleaned ? `，清理旧备份 ${cleaned} 份` : ''}`))

    await db.maintenanceLog.update({
      where: { id: logId },
      data: { status: 'completed', phase: 'completed', fileSize: st.size, fileSha256: sha, eventsJson: JSON.stringify(events), completedAt: new Date() },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    events.push(newEvent('error', 'completed', `备份失败: ${msg}`))
    await db.maintenanceLog.update({
      where: { id: logId },
      data: { status: 'failed', errorMessage: msg, eventsJson: JSON.stringify(events), completedAt: new Date() },
    })
    throw e
  }
}

// ============ SQL 迁移 ============

const ALLOWED_PREFIXES = ['INSERT', 'UPDATE', 'CREATE TABLE', 'CREATE INDEX', 'CREATE UNIQUE INDEX', 'ALTER TABLE', 'DELETE FROM']
const FORBIDDEN_KEYWORDS = ['DROP DATABASE', 'DROP TABLE', 'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM']

export function parseSqlStatements(raw: string): string[] {
  const noComments = raw
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function isStatementAllowed(sql: string): { ok: boolean; reason?: string } {
  const upper = sql.toUpperCase()
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (upper.includes(kw)) return { ok: false, reason: `禁止的语句: ${kw}` }
  }
  const allowed = ALLOWED_PREFIXES.some((p) => upper.startsWith(p))
  if (!allowed) return { ok: false, reason: '不在白名单内' }
  return { ok: true }
}

export async function parseSqlMigrate(opts: { sql: string; actorId?: string }): Promise<{ id: string }> {
  const log = await db.maintenanceLog.create({
    data: { type: 'migrate', status: 'running', phase: 'schema', actorId: opts.actorId || null },
  })

  void executeMigrate(log.id, opts.sql).catch(async (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    await db.maintenanceLog.update({
      where: { id: log.id },
      data: { status: 'failed', errorMessage: msg, completedAt: new Date() },
    })
  })

  return { id: log.id }
}

async function executeMigrate(logId: string, rawSql: string): Promise<void> {
  const events: DbMaintenanceEvent[] = []
  const tableStats: Record<string, { rows: number; ok: boolean }> = {}
  try {
    const stmts = parseSqlStatements(rawSql)
    events.push(newEvent('info', 'schema', `解析到 ${stmts.length} 条 SQL 语句`))
    await db.maintenanceLog.update({
      where: { id: logId },
      data: { totalTables: stmts.length, eventsJson: JSON.stringify(events) },
    })

    let processed = 0
    for (const stmt of stmts) {
      const check = isStatementAllowed(stmt)
      if (!check.ok) {
        events.push(newEvent('warn', 'data', `跳过: ${check.reason} — ${stmt.slice(0, 60)}…`))
        continue
      }
      try {
        await db.$executeRawUnsafe(stmt)
        processed++
        const key = stmt.slice(0, 40)
        tableStats[key] = { rows: 0, ok: true }
        events.push(newEvent('info', 'data', `执行成功: ${stmt.slice(0, 50)}…`, key))
        await db.maintenanceLog.update({
          where: { id: logId },
          data: { processedTables: processed, currentTable: key, tableStatsJson: JSON.stringify(tableStats), eventsJson: JSON.stringify(events) },
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const key = stmt.slice(0, 40)
        tableStats[key] = { rows: 0, ok: false }
        events.push(newEvent('error', 'data', `执行失败: ${msg} — ${stmt.slice(0, 50)}…`, key))
        await db.maintenanceLog.update({
          where: { id: logId },
          data: { tableStatsJson: JSON.stringify(tableStats), eventsJson: JSON.stringify(events) },
        })
      }
    }

    events.push(newEvent('info', 'completed', `迁移完成，成功 ${processed}/${stmts.length} 条`))
    await db.maintenanceLog.update({
      where: { id: logId },
      data: { status: 'completed', phase: 'completed', processedTables: processed, tableStatsJson: JSON.stringify(tableStats), eventsJson: JSON.stringify(events), completedAt: new Date() },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    events.push(newEvent('error', 'completed', `迁移失败: ${msg}`))
    await db.maintenanceLog.update({
      where: { id: logId },
      data: { status: 'failed', errorMessage: msg, eventsJson: JSON.stringify(events), completedAt: new Date() },
    })
    throw e
  }
}

// ============ 查询 ============

export async function listMaintenanceLogs(limit = 30) {
  return db.maintenanceLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
}

export async function getMaintenanceLog(id: string) {
  return db.maintenanceLog.findUnique({ where: { id } })
}

// ============ 授权码 ============

/** 授权码：env DB_MAINT_TOKEN 必须配置且匹配，否则拒绝（V3.12 强制） */
export function checkDbMaintToken(token: unknown): boolean {
  const envToken = process.env.DB_MAINT_TOKEN
  if (!envToken) return false // 未配置时拒绝所有操作
  return token === envToken
}

export function isDbMaintTokenConfigured(): boolean {
  return Boolean(process.env.DB_MAINT_TOKEN)
}
