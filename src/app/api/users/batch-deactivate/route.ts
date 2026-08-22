import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/users/batch-deactivate
 * 批量停用/启用账号，仅超管。
 * body: { ids: string[], isActive: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { ids, isActive } = body as { ids?: string[]; isActive?: boolean }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids 必须为非空数组' }, { status: 400 })
    }
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, error: 'isActive 必须为布尔值' }, { status: 400 })
    }

    // 防止停用自己的账号
    if (!isActive && ids.includes(auth.user.id)) {
      return NextResponse.json({ success: false, error: '不能停用自己的账号' }, { status: 400 })
    }

    const result = await db.$transaction(
      ids.map((id) => db.user.update({ where: { id }, data: { isActive } }))
    )

    return NextResponse.json({ success: true, data: { updated: result.length } })
  } catch (error) {
    console.error('Batch deactivate error:', error)
    return NextResponse.json({ success: false, error: '批量操作失败' }, { status: 500 })
  }
}
