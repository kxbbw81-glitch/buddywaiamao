import { db } from '@/lib/db'
import { requireAuth, customerScopeWhere } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { revealEncryptedContact } from '@/lib/contact-pii'

/**
 * GET /api/customer-profile?customerId=xxx
 * 客户全维度画像：基本信息、联系人、商机阶段分布、订单回款、样品、活动时间线
 * sales 仅可查看自己名下客户
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const user = auth.user

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  if (!customerId) {
    return NextResponse.json({ success: false, error: '缺少 customerId 参数' }, { status: 400 })
  }

  // 数据范围校验：sales 仅本人名下
  const scope = customerScopeWhere(user)
  const customer = await db.customer.findFirst({
    where: { id: customerId, ...scope },
    include: {
      owner: { select: { id: true, name: true, email: true, primaryRole: true } },
      contacts: { orderBy: { createdAt: 'asc' } },
      opportunities: {
        orderBy: { updatedAt: 'desc' },
        include: { owner: { select: { name: true } } },
      },
      orders: { orderBy: { createdAt: 'desc' } },
      samples: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!customer) {
    return NextResponse.json({ success: false, error: '客户不存在或无权访问' }, { status: 404 })
  }

  // 活动时间线（按 entityType=customer 关联）
  const activities = await db.activity.findMany({
    where: { entityType: 'customer', entityId: customerId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { user: { select: { name: true } } },
  })

  // 商机阶段分布统计
  const stageStats: Record<string, { count: number; amount: number }> = {}
  let totalOppAmount = 0
  let wonCount = 0
  let wonAmount = 0
  for (const opp of customer.opportunities) {
    const s = opp.stage
    if (!stageStats[s]) stageStats[s] = { count: 0, amount: 0 }
    stageStats[s].count += 1
    stageStats[s].amount += opp.amount
    totalOppAmount += opp.amount
    if (s === 'won') { wonCount += 1; wonAmount += opp.amount }
  }

  // 订单回款统计
  let totalOrderAmount = 0
  let totalPaid = 0
  const orderStatusStats: Record<string, { count: number; amount: number }> = {}
  for (const o of customer.orders) {
    totalOrderAmount += o.totalAmount
    totalPaid += o.paidAmount
    const s = o.status
    if (!orderStatusStats[s]) orderStatusStats[s] = { count: 0, amount: 0 }
    orderStatusStats[s].count += 1
    orderStatusStats[s].amount += o.totalAmount
  }

  // 解析标签
  let tags: string[] = []
  try { tags = JSON.parse(customer.tags || '[]') } catch { tags = [] }

  // 解析 AI 画像（若存在）
  let aiProfile: Record<string, unknown> | null = null
  if (customer.aiProfile) {
    try { aiProfile = JSON.parse(customer.aiProfile) } catch { aiProfile = null }
  }

  // 联系人里的决策人
  const contacts = customer.contacts.map(revealEncryptedContact)
  const decisionMakers = contacts.filter((c) => c.isDecisionMaker)

  const profile = {
    customer: {
      id: customer.id,
      companyName: customer.companyName,
      companyNameEn: customer.companyNameEn,
      country: customer.country,
      city: customer.city,
      website: customer.website,
      industry: customer.industry,
      customerLevel: customer.customerLevel,
      source: customer.source,
      status: customer.status,
      notes: customer.notes,
      aiScore: customer.aiScore,
      lastContactAt: customer.lastContactAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      owner: customer.owner,
      tags,
      aiProfile,
    },
    contacts: contacts.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      whatsapp: c.whatsapp, position: c.position, isDecisionMaker: c.isDecisionMaker, notes: c.notes,
    })),
    decisionMakers,
    opportunityStats: {
      total: customer.opportunities.length,
      totalAmount: totalOppAmount,
      wonCount,
      wonAmount,
      stageBreakdown: Object.entries(stageStats).map(([stage, v]) => ({ stage, ...v })),
    },
    opportunities: customer.opportunities.map((o) => ({
      id: o.id, title: o.title, stage: o.stage, amount: o.amount, currency: o.currency,
      probability: o.probability, expectedCloseDate: o.expectedCloseDate, closedAt: o.closedAt,
      lostReason: o.lostReason, ownerName: o.owner?.name || '未分配', createdAt: o.createdAt, updatedAt: o.updatedAt,
    })),
    orderStats: {
      total: customer.orders.length,
      totalAmount: totalOrderAmount,
      totalPaid,
      outstanding: totalOrderAmount - totalPaid,
      collectionRate: totalOrderAmount > 0 ? Math.round((totalPaid / totalOrderAmount) * 1000) / 10 : 0,
      statusBreakdown: Object.entries(orderStatusStats).map(([status, v]) => ({ status, ...v })),
    },
    orders: customer.orders.map((o) => ({
      id: o.id, orderNo: o.orderNo, status: o.status, totalAmount: o.totalAmount, currency: o.currency,
      paidAmount: o.paidAmount, paymentTerm: o.paymentTerm, deliveryDate: o.deliveryDate,
      createdAt: o.createdAt, updatedAt: o.updatedAt,
    })),
    samples: customer.samples.map((s) => ({
      id: s.id, status: s.status, createdAt: s.createdAt,
    })),
    activities: activities.map((a) => ({
      id: a.id, type: a.type, subject: a.subject, content: a.content,
      userName: a.user?.name || '系统', createdAt: a.createdAt,
    })),
  }

  return NextResponse.json({ success: true, data: profile })
}
