import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // ===== 1. Core KPIs =====
    const totalCustomers = await db.customer.count({ where: { status: 'active' } })
    const totalInquiries = await db.inquiry.count()
    const wonInquiries = await db.inquiry.count({ where: { status: 'won' } })
    const lostInquiries = await db.inquiry.count({ where: { status: 'lost' } })
    const totalOrders = await db.order.count({ where: { status: { notIn: ['cancelled'] } } })
    const completedOrders = await db.order.count({ where: { status: 'completed' } })

    const revenueResult = await db.order.aggregate({
      where: { status: { notIn: ['cancelled'] } },
      _sum: { totalAmount: true, paidAmount: true },
    })
    const totalRevenue = revenueResult._sum.totalAmount || 0
    const totalPaid = revenueResult._sum.paidAmount || 0

    const conversionRate = totalInquiries > 0
      ? Math.round((wonInquiries / totalInquiries) * 1000) / 10
      : 0

    const collectionRate = totalRevenue > 0
      ? Math.round((totalPaid / totalRevenue) * 1000) / 10
      : 0

    // ===== 2. Monthly Revenue Trend (12 months) =====
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

    const monthlyRevenue: Array<{ month: string; revenue: number; orderCount: number }> = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = revenueTrendRaw.find((r) => r.ym === ym)
      monthlyRevenue.push({
        month: `${d.getMonth() + 1}月`,
        revenue: found ? Number(found.total) : 0,
        orderCount: 0,
      })
    }

    const orderCountRaw = await db.$queryRaw<Array<{ ym: string; cnt: bigint }>>`
      SELECT strftime('%Y-%m', "createdAt") as ym, COUNT(*) as cnt
      FROM "Order"
      WHERE "createdAt" >= ${twelveMonthsAgo.toISOString()}
      AND "status" != 'cancelled'
      GROUP BY strftime('%Y-%m', "createdAt")
      ORDER BY ym ASC
    `
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = orderCountRaw.find((r) => r.ym === ym)
      monthlyRevenue[i].orderCount = found ? Number(found.cnt) : 0
    }

    // ===== 3. Sales Funnel =====
    const inquiryStatusCounts = await db.inquiry.groupBy({ by: ['status'], _count: true })
    const statusMap: Record<string, number> = {}
    for (const item of inquiryStatusCounts) {
      statusMap[item.status] = item._count
    }

    const funnelData = [
      { stage: '全部询盘', count: totalInquiries, color: '#06b6d4' },
      { stage: '跟进中', count: (statusMap['assigned'] || 0) + (statusMap['following'] || 0), color: '#10b981' },
      { stage: '已报价', count: statusMap['quoted'] || 0, color: '#f59e0b' },
      { stage: '已成交', count: statusMap['won'] || 0, color: '#22c55e' },
      { stage: '已流失', count: statusMap['lost'] || 0, color: '#ef4444' },
    ]

    // ===== 4. Country/Region Distribution =====
    const countryRevenue = await db.$queryRaw<Array<{ country: string; total: bigint }>>`
      SELECT c."country" as country, SUM(o."totalAmount") as total
      FROM "Order" o
      JOIN "Customer" c ON o."customerId" = c."id"
      WHERE o."status" != 'cancelled' AND c."country" IS NOT NULL
      GROUP BY c."country"
      ORDER BY total DESC
      LIMIT 10
    `

    const regionData = countryRevenue.map((r) => ({
      country: r.country,
      revenue: Number(r.total),
    }))

    const customersByCountry = await db.customer.groupBy({
      by: ['country'],
      _count: true,
      where: { status: 'active', country: { not: null } },
    })

    const customerCountryData = customersByCountry
      .filter((c) => c.country)
      .sort((a, b) => b._count - a._count)
      .map((c) => ({ country: c.country, count: c._count }))
      .slice(0, 10)

    // ===== 5. Sales Team Performance =====
    const users = await db.user.findMany({
      select: { id: true, name: true, primaryRole: true },
      where: { isActive: true, primaryRole: { in: ['sales', 'sales_manager'] } },
    })

    const salesTeamPerformance = await Promise.all(
      users.map(async (user) => {
        const inquiryCount = await db.inquiry.count({ where: { assignedTo: user.id } })
        const wonCount = await db.inquiry.count({ where: { assignedTo: user.id, status: 'won' } })

        const orderResult = await db.order.aggregate({
          where: { createdById: user.id, status: { notIn: ['cancelled'] } },
          _sum: { totalAmount: true },
          _count: true,
        })

        const activeCount = await db.inquiry.count({
          where: { assignedTo: user.id, status: { in: ['new', 'assigned', 'following'] } },
        })

        return {
          name: user.name,
          role: user.primaryRole,
          inquiryCount,
          wonCount,
          orderCount: orderResult._count,
          revenue: orderResult._sum.totalAmount || 0,
          conversionRate: inquiryCount > 0 ? Math.round((wonCount / inquiryCount) * 1000) / 10 : 0,
          activePipeline: activeCount,
        }
      })
    )
    salesTeamPerformance.sort((a, b) => b.revenue - a.revenue)

    // ===== 6. Inquiry Source Distribution =====
    const sourceRaw = await db.inquiry.groupBy({ by: ['source'], _count: true })

    const SOURCE_LABELS: Record<string, string> = {
      email: '邮件', website: '官网', whatsapp: 'WhatsApp',
      exhibition: '展会', b2b_alibaba: 'B2B平台', linkedin: 'LinkedIn',
      social_media: '社交媒体', manual: '手动录入', referral: '客户介绍',
    }

    const sourceData = sourceRaw
      .map((item) => ({ name: SOURCE_LABELS[item.source] || item.source, value: item._count }))
      .sort((a, b) => b.value - a.value)

    // ===== 7. Order Status Distribution =====
    const orderStatusRaw = await db.order.groupBy({ by: ['status'], _count: true })

    const ORDER_STATUS_LABELS: Record<string, string> = {
      pending: '待确认', confirmed: '已确认', in_production: '生产中',
      ready: '待发货', shipped: '已发货', completed: '已完成', cancelled: '已取消',
    }

    const orderStatusData = orderStatusRaw
      .map((item) => ({
        name: ORDER_STATUS_LABELS[item.status] || item.status,
        value: item._count,
      }))
      .sort((a, b) => b.value - a.value)

    // ===== 8. Customer Level Distribution =====
    const customersByLevel = await db.customer.groupBy({
      by: ['customerLevel'],
      _count: true,
      where: { status: 'active' },
    })

    const LEVEL_LABELS: Record<string, string> = { A: 'A级', B: 'B级', C: 'C级', D: 'D级' }

    const customerLevelData = customersByLevel.map((c) => ({
      level: LEVEL_LABELS[c.customerLevel] || c.customerLevel,
      count: c._count,
    }))

    // ===== 9. Top 10 Customers by Revenue =====
    const topCustomerRevenue = await db.$queryRaw<Array<{ customerId: string; total: bigint }>>`
      SELECT "customerId", SUM("totalAmount") as total
      FROM "Order"
      WHERE "status" != 'cancelled' AND "customerId" IS NOT NULL
      GROUP BY "customerId"
      ORDER BY total DESC
      LIMIT 10
    `

    const topCustomers = await Promise.all(
      topCustomerRevenue.map(async (r) => {
        const customer = await db.customer.findUnique({
          where: { id: r.customerId },
          select: { companyName: true, country: true },
        })
        return {
          name: customer?.companyName || 'Unknown',
          country: customer?.country ?? '',
          revenue: Number(r.total),
        }
      })
    )

    // ===== 10. Risk Alerts =====
    const overduePayments = await db.payment.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { lt: new Date() } },
      include: { order: { include: { customer: { select: { companyName: true } } } } },
      take: 5,
    })

    const lowMarginQuotes = await db.quotation.findMany({
      where: { marginCheckPassed: false },
      include: { customer: { select: { companyName: true } } },
      take: 3,
    })

    const unassignedCount = await db.inquiry.count({ where: { assignedTo: null, status: 'new' } })

    const riskAlerts = [
      ...overduePayments.map((p) => ({
        type: 'overdue' as const,
        level: 'danger' as const,
        message: `${p.order.customer?.companyName || ''} 逾期 $${(p.amount || 0).toLocaleString()}`,
      })),
      ...lowMarginQuotes.map((q) => ({
        type: 'low_margin' as const,
        level: 'warning' as const,
        message: `${q.customer?.companyName || q.quoteNo} 利润率 ${q.profitRate.toFixed(1)}%`,
      })),
      ...(unassignedCount > 0 ? [{
        type: 'unassigned' as const,
        level: 'info' as const,
        message: `${unassignedCount} 条询盘待分配`,
      }] : []),
    ]

    // ===== 11. Recent Activities =====
    const recentActivities = await db.activity.findMany({
      include: { user: { select: { name: true, primaryRole: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    })

    // ===== 12. Payment Status Summary =====
    const paymentStatusRaw = await db.payment.groupBy({ by: ['status'], _count: true, _sum: { amount: true } })
    const PAYMENT_LABELS: Record<string, string> = {
      pending: '待付款', partial: '部分付款', completed: '已付清', overdue: '逾期',
    }
    const paymentStatusData = paymentStatusRaw.map((p) => ({
      name: PAYMENT_LABELS[p.status] || p.status,
      count: p._count,
      amount: Number(p._sum.amount || 0),
    }))

    // ===== 13. This month stats =====
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    thisMonthStart.setHours(0, 0, 0, 0)

    const thisMonthInquiries = await db.inquiry.count({ where: { createdAt: { gte: thisMonthStart } } })
    const thisMonthOrders = await db.order.count({ where: { createdAt: { gte: thisMonthStart }, status: { notIn: ['cancelled'] } } })
    const thisMonthRevenueResult = await db.order.aggregate({
      where: { createdAt: { gte: thisMonthStart }, status: { notIn: ['cancelled'] } },
      _sum: { totalAmount: true },
    })
    const thisMonthRevenue = thisMonthRevenueResult._sum.totalAmount || 0
    const thisMonthCustomers = await db.customer.count({ where: { createdAt: { gte: thisMonthStart } } })

    // ===== 14. Inquiry Trend (last 6 months) =====
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

    const inquiryTrend: Array<{ month: string; value: number }> = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo)
      d.setMonth(d.getMonth() + i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = inquiryTrendRaw.find((r) => r.ym === ym)
      inquiryTrend.push({ month: `${d.getMonth() + 1}月`, value: found ? Number(found.count) : 0 })
    }

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalCustomers,
          totalInquiries,
          wonInquiries,
          lostInquiries,
          totalOrders,
          completedOrders,
          totalRevenue,
          totalPaid,
          conversionRate,
          collectionRate,
          thisMonthInquiries,
          thisMonthOrders,
          thisMonthRevenue,
          thisMonthCustomers,
        },
        monthlyRevenue,
        funnelData,
        regionData,
        customerCountryData,
        salesTeamPerformance,
        sourceData,
        orderStatusData,
        customerLevelData,
        topCustomers,
        riskAlerts,
        recentActivities,
        paymentStatusData,
        inquiryTrend,
      },
    })
  } catch (error) {
    console.error('DataScreen GET error:', error)
    return NextResponse.json({ success: false, error: '获取大屏数据失败' }, { status: 500 })
  }
}
