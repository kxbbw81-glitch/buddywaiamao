import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function getDateRangeFilter(dateRange: string) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (dateRange) {
    case 'this_week': {
      const day = now.getDay() || 7
      const startOfWeek = new Date(year, month, now.getDate() - day + 1)
      startOfWeek.setHours(0, 0, 0, 0)
      return { gte: startOfWeek }
    }
    case 'this_month': {
      const startOfMonth = new Date(year, month, 1)
      startOfMonth.setHours(0, 0, 0, 0)
      return { gte: startOfMonth }
    }
    case 'this_quarter': {
      const quarterStart = new Date(year, Math.floor(month / 3) * 3, 1)
      quarterStart.setHours(0, 0, 0, 0)
      return { gte: quarterStart }
    }
    case 'this_year':
    default: {
      const startOfYear = new Date(year, 0, 1)
      startOfYear.setHours(0, 0, 0, 0)
      return { gte: startOfYear }
    }
  }
}

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || 'this_year'

    const dateFilter = getDateRangeFilter(dateRange)

    // 1. Monthly inquiry trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const inquiryTrendRaw = await db.$queryRaw<Array<{ ym: string; count: bigint }>>`
      SELECT strftime('%Y-%m', "createdAt") as ym, COUNT(*) as count
      FROM "Inquiry"
      WHERE "createdAt" >= ${sixMonthsAgo.toISOString()}
      GROUP BY strftime('%Y-%m', "createdAt")
      ORDER BY ym ASC
    `

    // Fill in missing months
    const inquiryTrend: Array<{ month: string; value: number }> = []
    const monthSet = new Set(inquiryTrendRaw.map((r) => r.ym))
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = inquiryTrendRaw.find((r) => r.ym === ym)
      inquiryTrend.push({
        month: getMonthLabel(ym),
        value: found ? Number(found.count) : 0,
      })
    }

    // 2. Monthly quotation trend
    const quotationTrendRaw = await db.$queryRaw<Array<{ ym: string; count: bigint }>>`
      SELECT strftime('%Y-%m', "createdAt") as ym, COUNT(*) as count
      FROM "Quotation"
      WHERE "createdAt" >= ${sixMonthsAgo.toISOString()}
      GROUP BY strftime('%Y-%m', "createdAt")
      ORDER BY ym ASC
    `

    const quotationTrend: Array<{ month: string; value: number }> = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = quotationTrendRaw.find((r) => r.ym === ym)
      quotationTrend.push({
        month: getMonthLabel(ym),
        value: found ? Number(found.count) : 0,
      })
    }

    // 3. Monthly order trend
    const orderTrendRaw = await db.$queryRaw<Array<{ ym: string; count: bigint }>>`
      SELECT strftime('%Y-%m', "createdAt") as ym, COUNT(*) as count
      FROM "Order"
      WHERE "createdAt" >= ${sixMonthsAgo.toISOString()}
      GROUP BY strftime('%Y-%m', "createdAt")
      ORDER BY ym ASC
    `

    const orderTrend: Array<{ month: string; value: number }> = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = orderTrendRaw.find((r) => r.ym === ym)
      orderTrend.push({
        month: getMonthLabel(ym),
        value: found ? Number(found.count) : 0,
      })
    }

    // 4. Funnel data: inquiry counts by status category
    const inquiryStatusCounts = await db.inquiry.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: dateFilter },
    })

    const statusMap: Record<string, number> = {}
    for (const item of inquiryStatusCounts) {
      statusMap[item.status] = item._count
    }

    const funnelData = [
      { stage: '询盘', value: (statusMap['new'] || 0) + (statusMap['assigned'] || 0) + (statusMap['following'] || 0) + (statusMap['quoted'] || 0) + (statusMap['won'] || 0) + (statusMap['lost'] || 0) + (statusMap['pooled'] || 0) + (statusMap['closed'] || 0) },
      { stage: '报价', value: statusMap['quoted'] || 0 },
      { stage: '订单', value: statusMap['won'] || 0 },
      { stage: '流失', value: statusMap['lost'] || 0 },
    ]

    // 5. Source data: count inquiries by source
    const sourceRaw = await db.inquiry.groupBy({
      by: ['source'],
      _count: true,
      where: { createdAt: dateFilter },
    })

    const SOURCE_LABELS: Record<string, string> = {
      email: '邮件',
      website: '官网',
      whatsapp: 'WhatsApp',
      exhibition: '展会',
      b2b_alibaba: 'B2B平台',
      linkedin: 'LinkedIn',
      social_media: '社交媒体',
      manual: '手动录入',
      referral: '客户介绍',
    }

    const sourceData = sourceRaw
      .map((item) => ({
        name: SOURCE_LABELS[item.source] || item.source,
        value: item._count,
      }))
      .sort((a, b) => b.value - a.value)

    // 6. Sales ranking: per user, count inquiries, sum order revenue, conversion rate
    const users = await db.user.findMany({
      select: { id: true, name: true },
      where: { isActive: true },
    })

    const salesRanking = await Promise.all(
      users.map(async (user) => {
        const inquiryCount = await db.inquiry.count({
          where: { assignedTo: user.id, createdAt: dateFilter },
        })

        const wonCount = await db.inquiry.count({
          where: { assignedTo: user.id, status: 'won', createdAt: dateFilter },
        })

        const orderRevenueResult = await db.order.aggregate({
          where: { createdById: user.id, status: { not: 'cancelled' }, createdAt: dateFilter },
          _sum: { totalAmount: true },
        })

        const revenue = orderRevenueResult._sum.totalAmount || 0
        const conversionRate = inquiryCount > 0 ? Math.round((wonCount / inquiryCount) * 1000) / 10 : 0

        return {
          name: user.name,
          inquiries: inquiryCount,
          revenue,
          conversionRate,
        }
      })
    )

    salesRanking.sort((a, b) => b.revenue - a.revenue)

    // 7. Order status distribution
    const orderStatusRaw = await db.order.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: dateFilter },
    })

    const ORDER_STATUS_LABELS: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      in_production: '生产中',
      ready: '待发货',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消',
    }

    const orderStatusData = orderStatusRaw
      .map((item) => ({
        name: ORDER_STATUS_LABELS[item.status] || item.status,
        value: item._count,
      }))
      .sort((a, b) => b.value - a.value)

    return NextResponse.json({
      success: true,
      data: {
        inquiryTrend,
        quotationTrend,
        orderTrend,
        funnelData,
        sourceData,
        salesRanking,
        orderStatusData,
      },
    })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json({ success: false, error: '获取分析数据失败' }, { status: 500 })
  }
}
