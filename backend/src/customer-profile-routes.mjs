import { assertCrmAccess, assertCustomerScope, scopeFor } from './access.mjs'
import { HttpError, send, text } from './http.mjs'

// 客户画像聚合：基本信息 + 联系人 + 商机阶段分布 + 订单回款 + 沟通时间线 + 样品
// 权限：SALES 仅本人名下客户；MANAGER 本团队；EXEC/ADMIN 全量（assertCustomerScope）

function num(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money2(value) {
  return Number(num(value).toFixed(2))
}

export async function handleCustomerProfileRoute({ req, res, url, pathname, actor, db }) {
  // GET /api/customers/:id/profile — 客户全维度画像
  const profileMatch = pathname.match(/^\/api\/customers\/([^/]+)\/profile$/)
  if (req.method === 'GET' && profileMatch) {
    assertCrmAccess(actor)
    const customerId = profileMatch[1]
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true, teamId: true } },
        contacts: { orderBy: { createdAt: 'asc' } },
        opportunities: {
          orderBy: { updatedAt: 'desc' },
          include: { owner: { select: { name: true } } },
        },
        salesOrders: {
          orderBy: { createdAt: 'desc' },
          include: { payments: { where: { status: 'CONFIRMED' } } },
        },
        sampleRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
    assertCustomerScope(actor, customer)

    // 沟通时间线（CommunicationEvent，按客户聚合）
    const communicationEvents = await db.communicationEvent.findMany({
      where: { customerId },
      orderBy: { occurredAt: 'desc' },
      take: 30,
      include: { owner: { select: { name: true } } },
    })

    // 商机阶段分布
    const stageMap = new Map()
    let totalOppAmount = 0
    let wonCount = 0
    let wonAmount = 0
    for (const opp of customer.opportunities) {
      const stage = String(opp.stage)
      const amount = money2(opp.amount)
      const entry = stageMap.get(stage) || { stage, count: 0, amount: 0 }
      entry.count += 1
      entry.amount = Number((entry.amount + amount).toFixed(2))
      stageMap.set(stage, entry)
      totalOppAmount = Number((totalOppAmount + amount).toFixed(2))
      if (stage === 'WON' || stage === 'CLOSED_WON' || stage === 'won') { wonCount += 1; wonAmount = Number((wonAmount + amount).toFixed(2)) }
    }

    // 订单回款统计
    let totalOrderAmount = 0
    let totalPaid = 0
    const orderStatusMap = new Map()
    for (const o of customer.salesOrders) {
      const amount = money2(o.totalAmount)
      totalOrderAmount = Number((totalOrderAmount + amount).toFixed(2))
      const paid = o.payments.reduce((sum, p) => sum + money2(p.amount), 0)
      totalPaid = Number((totalPaid + paid).toFixed(2))
      const status = String(o.status)
      const entry = orderStatusMap.get(status) || { status, count: 0, amount: 0 }
      entry.count += 1
      entry.amount = Number((entry.amount + amount).toFixed(2))
      orderStatusMap.set(status, entry)
    }

    const profile = {
      customer: {
        id: customer.id,
        name: customer.name,
        country: customer.country,
        website: customer.website,
        ownerId: customer.ownerId,
        owner: customer.owner ? { id: customer.owner.id, name: customer.owner.name, email: customer.owner.email, role: customer.owner.role } : null,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      contacts: customer.contacts.map((c) => ({
        id: c.id, name: c.name, title: c.title, email: c.email, phone: c.phone,
      })),
      opportunityStats: {
        total: customer.opportunities.length,
        totalAmount: totalOppAmount,
        wonCount,
        wonAmount,
        stageBreakdown: [...stageMap.values()],
      },
      opportunities: customer.opportunities.map((o) => ({
        id: o.id, name: o.name, stage: String(o.stage), amount: money2(o.amount), currency: o.currency,
        ownerName: o.owner?.name || '未分配', createdAt: o.createdAt, updatedAt: o.updatedAt,
      })),
      orderStats: {
        total: customer.salesOrders.length,
        totalAmount: totalOrderAmount,
        totalPaid,
        outstanding: Number((totalOrderAmount - totalPaid).toFixed(2)),
        collectionRate: totalOrderAmount > 0 ? Number(((totalPaid / totalOrderAmount) * 100).toFixed(1)) : 0,
        statusBreakdown: [...orderStatusMap.values()],
      },
      orders: customer.salesOrders.map((o) => ({
        id: o.id, orderNo: o.orderNo, status: String(o.status), paymentStatus: String(o.paymentStatus),
        totalAmount: money2(o.totalAmount), currency: o.currency, createdAt: o.createdAt,
      })),
      samples: customer.sampleRequests.map((s) => ({ id: s.id, status: String(s.status || ''), createdAt: s.createdAt })),
      timeline: communicationEvents.map((e) => ({
        id: e.id, type: String(e.type || ''), summary: e.summary, content: e.content,
        occurredAt: e.occurredAt, userName: e.owner?.name || '系统',
      })),
    }
    return send(res, 200, { data: profile })
  }

  return false
}
