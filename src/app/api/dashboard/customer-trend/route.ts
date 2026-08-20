import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const now = new Date()
    const months: { month: string; startDate: Date; endDate: Date }[] = []

    // Generate last 6 months (including current month)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startDate = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({ month: monthLabel, startDate, endDate })
    }

    const trendData = await Promise.all(
      months.map(async (m) => {
        const count = await db.customer.count({
          where: {
            createdAt: {
              gte: m.startDate,
              lte: m.endDate,
            },
          },
        })
        return {
          month: m.month,
          count,
        }
      })
    )

    // Also get the current month's count for the KPI card
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const currentMonthCount = await db.customer.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        trend: trendData,
        currentMonthCount,
      },
    })
  } catch (error) {
    console.error('Customer trend GET error:', error)
    return NextResponse.json({ success: false, error: '获取客户趋势数据失败' }, { status: 500 })
  }
}
