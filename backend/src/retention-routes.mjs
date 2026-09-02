import { assertCrmAccess, scopeFor } from './access.mjs'
import { HttpError, send } from './http.mjs'

// 售后与复购看板：按客户聚合赢单商机（stage=WON）与已交付订单（fulfillmentStatus=DELIVERED），
// 推算复购窗口（最近成交日 + 消耗周期天数）。权限按角色数据范围（SALES 本人 / MANAGER 本团队 / ADMIN 全量）。

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_WINDOW = 90

function num(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money2(value) {
  return Number(num(value).toFixed(2))
}

function windowValue(raw) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_WINDOW
  return Math.max(30, Math.min(365, Math.round(parsed)))
}

function classify(daysLeft) {
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= 30) return 'near'
  return 'upcoming'
}

export async function handleRetentionRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/retention') {
    assertCrmAccess(actor)
    const windowDays = windowValue(url.searchParams.get('window'))
    const scope = scopeFor(actor)
    const customerSelect = {
      select: {
        id: true, name: true, country: true,
        owner: { select: { name: true } },
      },
    }

    // 赢单商机 + 已交付订单（成交事实来源）
    const [wonOpps, deliveredOrders] = await Promise.all([
      db.opportunity.findMany({
        where: { stage: 'WON', customer: scope },
        include: { customer: customerSelect },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
      db.salesOrder.findMany({
        where: { fulfillmentStatus: 'DELIVERED', customer: scope },
        include: { customer: customerSelect },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
    ])

    // 按客户聚合
    const byCustomer = new Map()
    const record = (customer, date, amount) => {
      if (!customer) return
      const cur = byCustomer.get(customer.id) || {
        customerId: customer.id,
        name: customer.name,
        country: customer.country,
        ownerName: customer.owner?.name || '未分配',
        lastDealAt: date,
        lastDealAmount: money2(amount),
        dealCount: 0,
        totalAmount: 0,
      }
      cur.dealCount += 1
      cur.totalAmount = Number((cur.totalAmount + money2(amount)).toFixed(2))
      if (date > cur.lastDealAt) {
        cur.lastDealAt = date
        cur.lastDealAmount = money2(amount)
      }
      byCustomer.set(customer.id, cur)
    }
    wonOpps.forEach((opp) => record(opp.customer, opp.updatedAt, opp.amount))
    deliveredOrders.forEach((order) => record(order.customer, order.updatedAt, order.totalAmount))

    const now = Date.now()
    const rows = [...byCustomer.values()].map((row) => {
      const repurchaseMs = row.lastDealAt.getTime() + windowDays * DAY_MS
      const daysLeft = Math.ceil((repurchaseMs - now) / DAY_MS)
      return {
        ...row,
        lastDealAt: row.lastDealAt.toISOString(),
        repurchaseAt: new Date(repurchaseMs).toISOString(),
        daysLeft,
        window: classify(daysLeft),
      }
    }).sort((a, b) => a.daysLeft - b.daysLeft)

    const stats = {
      total: rows.length,
      overdue: rows.filter((r) => r.window === 'overdue').length,
      near: rows.filter((r) => r.window === 'near').length,
      upcoming: rows.filter((r) => r.window === 'upcoming').length,
      totalAmount: Number(rows.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2)),
    }

    return send(res, 200, { data: { rows, stats, window: windowDays } })
  }

  return false
}
