import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body as { updates: { id: string; customerLevel: string }[] }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供要更新的客户数据' },
        { status: 400 }
      )
    }

    const validLevels = ['A', 'B', 'C', 'D']
    const filtered = updates.filter(
      (u) => u.id && validLevels.includes(u.customerLevel)
    )

    if (filtered.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有有效的更新数据' },
        { status: 400 }
      )
    }

    let successCount = 0
    for (const update of filtered) {
      try {
        await db.customer.update({
          where: { id: update.id },
          data: { customerLevel: update.customerLevel },
        })
        successCount++
      } catch {
        // skip failed individual updates
      }
    }

    return NextResponse.json({ success: true, data: { successCount } })
  } catch (error) {
    console.error('Bulk update error:', error)
    return NextResponse.json(
      { success: false, error: '批量更新客户级别失败' },
      { status: 500 }
    )
  }
}
