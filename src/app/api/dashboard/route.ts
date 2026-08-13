import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const totalCustomers = await db.customer.count({ where: { status: 'active' } })
    const totalInquiries = await db.inquiry.count()
    const activeInquiries = await db.inquiry.count({ where: { status: { in: ['new', 'assigned', 'following'] } } })
    const pendingQuotations = await db.quotation.count({ where: { status: { in: ['draft', 'pending', 'sent'] } } })
    const activeOrders = await db.order.count({ where: { status: { in: ['pending', 'confirmed', 'in_production', 'ready', 'shipped'] } } })
    const completedOrders = await db.order.count({ where: { status: 'completed' } })

    const revenueResult = await db.order.aggregate({
      where: { status: { in: ['confirmed', 'in_production', 'ready', 'shipped', 'completed'] } },
      _sum: { totalAmount: true, paidAmount: true },
    })
    const totalRevenue = revenueResult._sum.totalAmount || 0
    const totalPaid = revenueResult._sum.paidAmount || 0

    const wonInquiries = await db.inquiry.count({ where: { status: 'won' } })
    const lostInquiries = await db.inquiry.count({ where: { status: 'lost' } })

    const orderPayments = await db.order.findMany({
      where: { status: { in: ['pending', 'confirmed', 'in_production', 'ready', 'shipped'] } },
      select: { totalAmount: true, paidAmount: true, currency: true, orderNo: true, id: true, customer: { select: { companyName: true } } },
    })

    const overduePayments = await db.payment.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { lt: new Date() } },
      include: { order: { include: { customer: { select: { companyName: true } } } } },
    })

    const expiringQuotations = await db.quotation.findMany({
      where: {
        status: 'sent',
        validUntil: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), gt: new Date() },
      },
      include: { customer: { select: { companyName: true } } },
    })

    const unassignedInquiries = await db.inquiry.count({ where: { assignedTo: null, status: 'new' } })

    const lowMarginQuotes = await db.quotation.findMany({
      where: { marginCheckPassed: false },
      include: { customer: { select: { companyName: true } } },
    })

    const recentActivities = await db.activity.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const customersByLevel = await db.customer.groupBy({
      by: ['customerLevel'],
      _count: true,
      where: { status: 'active' },
    })

    const inquiriesByStatus = await db.inquiry.groupBy({
      by: ['status'],
      _count: true,
    })

    const ordersByStatus = await db.order.groupBy({
      by: ['status'],
      _count: true,
    })

    const revenueByCountry = await db.order.groupBy({
      by: ['currency'],
      where: { status: { in: ['confirmed', 'in_production', 'ready', 'shipped', 'completed'] } },
      _sum: { totalAmount: true },
    })

    const orderCustomerRevenue = await db.order.groupBy({
      by: ['customerId'],
      where: { status: { in: ['confirmed', 'in_production', 'ready', 'shipped', 'completed'] } },
      _sum: { totalAmount: true },
    })

    const topCustomers = await Promise.all(
      orderCustomerRevenue
        .sort((a, b) => (b._sum.totalAmount || 0) - (a._sum.totalAmount || 0))
        .slice(0, 10)
        .map(async (r) => {
          const customer = await db.customer.findUnique({ where: { id: r.customerId }, select: { companyName: true, country: true } })
          return { name: customer?.companyName || 'Unknown', country: customer?.country || '', revenue: r._sum.totalAmount || 0 }
        })
    )

    const sampleCount = await db.sample.count()
    const pendingSamples = await db.sample.count({ where: { status: { in: ['pending', 'approved', 'sent', 'in_transit', 'testing'] } } })

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalCustomers,
          totalInquiries,
          activeInquiries,
          pendingQuotations,
          activeOrders,
          completedOrders,
          totalRevenue,
          totalPaid,
          wonInquiries,
          lostInquiries,
          sampleCount,
          pendingSamples,
        },
        riskAlerts: [
          ...overduePayments.map((p) => {
            const overdueAmt = p.amount || 0
            return {
              type: 'overdue_payment' as const,
              level: 'danger' as const,
              message: overdueAmt > 0
                ? `${p.order.customer.companyName} 逾期款项 $${overdueAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : `${p.order.customer.companyName} 有逾期未确认的付款`,
              entityType: 'payment',
              entityId: p.id,
            }
          }),
          ...lowMarginQuotes.map((q) => ({
            type: 'low_margin' as const,
            level: 'warning' as const,
            message: `${q.customer?.companyName || q.quoteNo} 利润率 ${q.profitRate.toFixed(1)}% 低于预警线`,
            entityType: 'quotation',
            entityId: q.id,
          })),
          ...expiringQuotations.map((q) => ({
            type: 'expiring_quotation' as const,
            level: 'warning' as const,
            message: `${q.customer?.companyName || q.quoteNo} 报价即将到期`,
            entityType: 'quotation',
            entityId: q.id,
          })),
          ...(unassignedInquiries > 0 ? [{
            type: 'unassigned_inquiry' as const,
            level: 'info' as const,
            message: `${unassignedInquiries} 条询盘待分配`,
          }] : []),
        ],
        recentActivities,
        charts: {
          customersByLevel: customersByLevel.map((c) => ({ level: c.customerLevel, count: c._count })),
          inquiriesByStatus: inquiriesByStatus.map((i) => ({ status: i.status, count: i._count })),
          ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count })),
          topCustomers,
        },
      },
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ success: false, error: '获取仪表盘数据失败' }, { status: 500 })
  }
}
