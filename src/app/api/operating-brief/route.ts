import { db } from '@/lib/db'
import { requireAuth, customerScopeWhere, opportunityScopeWhere, isManager } from '@/lib/auth'
import { NextResponse } from 'next/server'

const STAGE_ORDER = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

/**
 * GET /api/operating-brief
 * 按角色聚合的经营简报：核心 KPI、销售管道、团队业绩、行动项、风险预警
 * - sales：仅看自己的数据范围（客户/商机按 ownerId，订单按 createdById，任务按 assigneeId）
 * - 管理层/经理/财务/超管：全局数据
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const user = auth.user
  const manager = isManager(user) || user.primaryRole === 'finance'

  // 数据范围
  const customerScope = customerScopeWhere(user)
  const oppScope = opportunityScopeWhere(user)
  const orderScope: Record<string, unknown> = {}
  if (!manager) orderScope.createdById = user.id
  const taskScope: Record<string, unknown> = {}
  if (!manager) taskScope.assigneeId = user.id

  // 日期边界
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

  // ===== 1. 概览 KPI =====
  const [
    customerCount, activeCustomerCount, monthNewCustomers,
    oppCount, monthNewOpps,
    orderCount, monthNewOrders,
    inquiryCount, monthNewInquiries,
  ] = await Promise.all([
    db.customer.count({ where: customerScope }),
    db.customer.count({ where: { ...customerScope, status: 'active' } }),
    db.customer.count({ where: { ...customerScope, createdAt: { gte: monthStart } } }),
    db.opportunity.count({ where: oppScope }),
    db.opportunity.count({ where: { ...oppScope, createdAt: { gte: monthStart } } }),
    db.order.count({ where: { ...orderScope, status: { not: 'cancelled' } } }),
    db.order.count({ where: { ...orderScope, status: { not: 'cancelled' }, createdAt: { gte: monthStart } } }),
    db.inquiry.count(),
    db.inquiry.count({ where: { createdAt: { gte: monthStart } } }),
  ])

  // 商机管道金额（排除 lost）
  const oppAmountAgg = await db.opportunity.aggregate({
    where: { ...oppScope, stage: { not: 'lost' } },
    _sum: { amount: true },
  })
  const wonAmountAgg = await db.opportunity.aggregate({
    where: { ...oppScope, stage: 'won' },
    _sum: { amount: true },
  })
  const pipelineAmount = oppAmountAgg._sum.amount || 0
  const wonAmount = wonAmountAgg._sum.amount || 0

  // 订单金额与回款
  const orderAmountAgg = await db.order.aggregate({
    where: { ...orderScope, status: { not: 'cancelled' } },
    _sum: { totalAmount: true, paidAmount: true },
  })
  const orderTotalAmount = orderAmountAgg._sum.totalAmount || 0
  const totalPaid = orderAmountAgg._sum.paidAmount || 0
  const monthOrderAgg = await db.order.aggregate({
    where: { ...orderScope, status: { not: 'cancelled' }, createdAt: { gte: monthStart } },
    _sum: { totalAmount: true },
  })
  const monthOrderAmount = monthOrderAgg._sum.totalAmount || 0

  // ===== 2. 销售管道（商机各阶段） =====
  const oppByStage = await db.opportunity.groupBy({
    by: ['stage'],
    where: oppScope,
    _count: true,
    _sum: { amount: true },
  })
  const stageMap = new Map(oppByStage.map((s) => [s.stage, s]))
  const pipeline = STAGE_ORDER.map((stage) => {
    const s = stageMap.get(stage)
    return { stage, count: s?._count || 0, amount: s?._sum.amount || 0 }
  }).filter((s) => s.count > 0)

  // ===== 3. 团队业绩排名（仅管理层返回全队；sales 仅自己） =====
  let teamRanking: { salesId: string; salesName: string; salesRole: string; orderCount: number; totalAmount: number; totalPaid: number; collectionRate: number }[] = []
  if (manager) {
    const orders = await db.order.findMany({
      where: { status: { not: 'cancelled' } },
      select: { totalAmount: true, paidAmount: true, createdById: true },
    })
    const bySales = new Map<string, { orderCount: number; totalAmount: number; totalPaid: number }>()
    for (const o of orders) {
      const sid = o.createdById || 'unassigned'
      let agg = bySales.get(sid)
      if (!agg) { agg = { orderCount: 0, totalAmount: 0, totalPaid: 0 }; bySales.set(sid, agg) }
      agg.orderCount += 1
      agg.totalAmount += o.totalAmount
      agg.totalPaid += o.paidAmount
    }
    const salesIds = [...bySales.keys()].filter((k) => k !== 'unassigned')
    const salesUsers = await db.user.findMany({ where: { id: { in: salesIds } }, select: { id: true, name: true, primaryRole: true, department: true } })
    const userMap = new Map(salesUsers.map((u) => [u.id, u]))
    teamRanking = [...bySales.entries()].map(([sid, a]) => ({
      salesId: sid,
      salesName: userMap.get(sid)?.name || (sid === 'unassigned' ? '未分配' : '未知'),
      salesRole: userMap.get(sid)?.primaryRole || '',
      orderCount: a.orderCount,
      totalAmount: Math.round(a.totalAmount * 100) / 100,
      totalPaid: Math.round(a.totalPaid * 100) / 100,
      collectionRate: a.totalAmount > 0 ? Math.round((a.totalPaid / a.totalAmount) * 1000) / 10 : 0,
    })).sort((x, y) => y.totalAmount - x.totalAmount)
  }

  // ===== 4. 行动项（跟进任务） =====
  const taskScopeWhere = taskScope.assigneeId ? { assigneeId: taskScope.assigneeId } : {}
  const [pendingTasks, todayDueTasks, overdueTasks, doneTasks] = await Promise.all([
    db.followupTask.count({ where: { ...taskScopeWhere, status: 'pending' } }),
    db.followupTask.count({ where: { ...taskScopeWhere, status: 'pending', dueDate: { gte: todayStart, lte: todayEnd } } }),
    db.followupTask.count({ where: { ...taskScopeWhere, status: 'pending', dueDate: { lt: todayStart } } }),
    db.followupTask.count({ where: { ...taskScopeWhere, status: 'done' } }),
  ])

  // ===== 5. 风险预警 =====
  const riskWhere = (manager ? {} : { order: { createdById: user.id } })
  const overduePayments = await db.payment.findMany({
    where: { status: { in: ['pending', 'partial'] }, dueDate: { lt: todayStart }, ...riskWhere },
    include: { order: { include: { customer: { select: { companyName: true } } } } },
    take: 10,
  })
  const expiringQuotations = await db.quotation.findMany({
    where: { status: 'sent', validUntil: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), gt: now } },
    include: { customer: { select: { companyName: true } } },
    take: 10,
  })
  const unassignedInquiries = await db.inquiry.count({ where: { assignedTo: null, status: 'new' } })
  const lowMarginQuotes = await db.quotation.findMany({ where: { marginCheckPassed: false }, include: { customer: { select: { companyName: true } } }, take: 10 })

  const riskAlerts = [
    ...overduePayments.map((p) => ({
      type: 'overdue_payment' as const, level: 'danger' as const,
      message: `${p.order.customer?.companyName || '未知客户'} 逾期款项 $${(p.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    })),
    ...lowMarginQuotes.map((q) => ({
      type: 'low_margin' as const, level: 'warning' as const,
      message: `${q.customer?.companyName || q.quoteNo} 利润率 ${(q.profitRate || 0).toFixed(1)}% 低于预警线`,
    })),
    ...expiringQuotations.map((q) => ({
      type: 'expiring_quotation' as const, level: 'warning' as const,
      message: `${q.customer?.companyName || q.quoteNo} 报价 7 天内到期`,
    })),
    ...(unassignedInquiries > 0 && manager ? [{
      type: 'unassigned_inquiry' as const, level: 'info' as const,
      message: `${unassignedInquiries} 条询盘待分配`,
    }] : []),
  ]

  return NextResponse.json({
    success: true,
    data: {
      scope: manager ? 'global' : 'self',
      overview: {
        customerCount, activeCustomerCount, monthNewCustomers,
        oppCount, monthNewOpps, pipelineAmount, wonAmount,
        orderCount, monthNewOrders, orderTotalAmount, totalPaid, monthOrderAmount,
        inquiryCount, monthNewInquiries,
        collectionRate: orderTotalAmount > 0 ? Math.round((totalPaid / orderTotalAmount) * 1000) / 10 : 0,
      },
      pipeline,
      teamRanking,
      followupStats: { pending: pendingTasks, todayDue: todayDueTasks, overdue: overdueTasks, done: doneTasks },
      riskAlerts,
      generatedAt: now.toISOString(),
    },
  })
}
