import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { checkDbMaintToken, parseSqlMigrate, parseSqlStatements, isStatementAllowed } from '@/lib/db-maintenance'

/**
 * POST /api/admin/db/maintenance/migrate
 * .sql/.sql.gz 浏览器端解析迁移（白名单语句，逐条执行，写 MaintenanceLog）
 * body: { sql: string, token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => null)
    const { sql, token } = body || {}

    if (!checkDbMaintToken(token)) {
      return NextResponse.json({ success: false, error: '数据库维护授权码不正确或未配置 DB_MAINT_TOKEN' }, { status: 403 })
    }
    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ success: false, error: 'sql 不能为空' }, { status: 400 })
    }

    // 预校验：解析 + 白名单检查（不执行）
    const stmts = parseSqlStatements(sql)
    const rejected: { sql: string; reason: string }[] = []
    for (const stmt of stmts) {
      const check = isStatementAllowed(stmt)
      if (!check.ok) rejected.push({ sql: stmt.slice(0, 80), reason: check.reason || '不允许' })
    }
    if (rejected.length > 0) {
      return NextResponse.json({
        success: false,
        error: `发现 ${rejected.length} 条不允许的语句，迁移未执行`,
        data: { rejected: rejected.slice(0, 10), totalStatements: stmts.length },
      }, { status: 400 })
    }

    const { id } = await parseSqlMigrate({ sql, actorId: auth.user.id })
    return NextResponse.json({ success: true, data: { jobId: id, totalStatements: stmts.length } })
  } catch (error) {
    console.error('DB migrate error:', error)
    return NextResponse.json({ success: false, error: '迁移失败' }, { status: 500 })
  }
}
