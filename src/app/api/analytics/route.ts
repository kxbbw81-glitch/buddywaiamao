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

function getFullMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

    // ============ NEW: Enhanced analytics data ============

    // 8. Monthly Revenue (past 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const revenueTrendRaw = await db.$queryRaw<Array<{ ym: string; total: bigint }>>`
      SELECT strftime('%Y-%m', "createdAt") as ym, SUM("totalAmount") as total
      FROM "Order"
      WHERE "createdAt" >= ${twelveMonthsAgo.toISOString()}
      AND "status" != 'cancelled'
      GROUP BY strftime('%Y-%m', "createdAt")
      ORDER BY ym ASC
    `

    const monthlyRevenue: Array<{ month: string; value: number }> = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = revenueTrendRaw.find((r) => r.ym === ym)
      monthlyRevenue.push({
        month: getFullMonthLabel(ym),
        value: found ? Number(found.total) : 0,
      })
    }

    // 9. Payment collection rate (paid / receivable)
    const allOrders = await db.order.findMany({
      where: { status: { not: 'cancelled' } },
      select: { totalAmount: true, paidAmount: true },
    })
    const totalReceivable = allOrders.reduce((s, o) => s + o.totalAmount, 0)
    const totalPaid = allOrders.reduce((s, o) => s + o.paidAmount, 0)
    const paymentCollectionRate = totalReceivable > 0
      ? Math.round((totalPaid / totalReceivable) * 1000) / 10
      : 0

    // 10. Average deal cycle (inquiry created -> order created, in days)
    const wonInquiries = await db.inquiry.findMany({
      where: { status: 'won' },
      select: { id: true, createdAt: true },
    })

    let totalCycleDays = 0
    let cycleCount = 0
    for (const inquiry of wonInquiries) {
      const order = await db.order.findFirst({
        where: { customerId: inquiry.customerId, status: { not: 'cancelled' } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      if (order) {
        const diffMs = order.createdAt.getTime() - inquiry.createdAt.getTime()
        totalCycleDays += Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
        cycleCount++
      }
    }
    const avgDealCycle = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0

    // 11. Top products by order count (via quotation items)
    const quotationItems = await db.quotationItem.findMany({
      select: { productName: true, quantity: true },
    })

    // Aggregate product order count from quotation items
    const productOrderMap: Record<string, { count: number; qty: number }> = {}
    for (const item of quotationItems) {
      if (!productOrderMap[item.productName]) {
        productOrderMap[item.productName] = { count: 0, qty: 0 }
      }
      productOrderMap[item.productName].count++
      productOrderMap[item.productName].qty += item.quantity
    }

    const topProducts = Object.entries(productOrderMap)
      .map(([name, data]) => ({ name, orderCount: data.count, quantity: data.qty }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10)

    // 12. Customer acquisition by source
    const customerSourceRaw = await db.customer.groupBy({
      by: ['source'],
      _count: true,
    })

    const CUSTOMER_SOURCE_LABELS: Record<string, string> = {
      exhibition: '展会',
      b2b_alibaba: 'B2B平台',
      linkedin: 'LinkedIn',
      email: '邮件',
      website: '官网',
      social_media: '社交媒体',
      referral: '客户介绍',
      whatsapp: 'WhatsApp',
      manual: '手动录入',
    }

    const customerAcquisition = customerSourceRaw
      .map((item) => ({
        name: CUSTOMER_SOURCE_LABELS[item.source] || item.source,
        value: item._count,
      }))
      .sort((a, b) => b.value - a.value)

    // 13. Sales performance by user (total order revenue, all time)
    const salesPerformance = await Promise.all(
      users.map(async (user) => {
        const result = await db.order.aggregate({
          where: { createdById: user.id, status: { not: 'cancelled' } },
          _sum: { totalAmount: true },
          _count: true,
        })
        return {
          name: user.name,
          revenue: result._sum.totalAmount || 0,
          orderCount: result._count,
        }
      })
    )
    salesPerformance.sort((a, b) => b.revenue - a.revenue)

    // 14. This month new customers & this month order amount
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    thisMonthStart.setHours(0, 0, 0, 0)

    const thisMonthCustomers = await db.customer.count({
      where: { createdAt: { gte: thisMonthStart } },
    })

    const thisMonthOrderResult = await db.order.aggregate({
      where: { createdAt: { gte: thisMonthStart }, status: { not: 'cancelled' } },
      _sum: { totalAmount: true },
    })
    const thisMonthOrderAmount = thisMonthOrderResult._sum.totalAmount || 0

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
        // Enhanced data
        monthlyRevenue,
        paymentCollectionRate,
        avgDealCycle,
        topProducts,
        customerAcquisition,
        salesPerformance,
        thisMonthCustomers,
        thisMonthOrderAmount,
      },
    })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json({ success: false, error: '获取分析数据失败' }, { status: 500 })
  }
}
