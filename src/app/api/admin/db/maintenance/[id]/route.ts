import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getMaintenanceLog } from '@/lib/db-maintenance'

/**
 * GET /api/admin/db/maintenance/[id]
 * 单个维护任务状态（含 tableStats/events），仅超管
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const log = await getMaintenanceLog(id)
    if (!log) {
      return NextResponse.json({ success: false, error: '维护任务不存在' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        ...log,
        tableStats: JSON.parse(log.tableStatsJson || '{}'),
        events: JSON.parse(log.eventsJson || '[]'),
      },
    })
  } catch (error) {
    console.error('MaintenanceLog GET error:', error)
    return NextResponse.json({ success: false, error: '获取维护任务失败' }, { status: 500 })
  }
}
