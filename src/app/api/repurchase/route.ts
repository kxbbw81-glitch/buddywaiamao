import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/** 默认消耗周期（天）：从最近成交日推算复购窗口 */
const DEFAULT_CYCLE_DAYS = 90

/**
 * GET /api/repurchase — 售后与复购看板数据
 * 按客户聚合赢单商机与已完成订单，推算复购窗口（最近成交日 + 消耗周期）
 * sales 仅看自己名下客户
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const cycleDays = Math.max(30, Math.min(365, parseInt(searchParams.get('cycleDays') || '') || DEFAULT_CYCLE_DAYS))

  // 数据范围：sales 仅本人名下客户
  const customerWhere = auth.user.primaryRole === 'sales' ? { ownerId: auth.user.id } : {}

  const customers = await db.customer.findMany({
    where: customerWhere,
    select: { id: true, companyName: true, country: true, customerLevel: true, owner: { select: { name: true } } },
  })
  const customerMap = new Map(customers.map((c) => [c.id, c]))

  const [wonOpps, completedOrders] = await Promise.all([
    db.opportunity.findMany({
      where: { stage: 'won', customerId: { in: [...customerMap.keys()] } },
      orderBy: { closedAt: 'desc' },
      include: { customer: { select: { companyName: true } } },
    }),
    db.order.findMany({
      where: { status: 'completed', customerId: { in: [...customerMap.keys()] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, customerId: true, orderNo: true, totalAmount: true, currency: true, updatedAt: true },
    }),
  ])

  // 按客户聚合最近成交
  interface RepurchaseRow {
    customerId: string
    companyName: string
    country: string
    customerLevel: string
    ownerName: string
    lastDealAt: string
    lastDealAmount: number
    dealCount: number
    totalAmount: number
    repurchaseAt: string
    daysLeft: number
    window: 'overdue' | 'near' | 'upcoming'
  }

  const byCustomer = new Map<string, { lastDealAt: Date; lastDealAmount: number; dealCount: number; totalAmount: number }>()
  const record = (customerId: string | null, date: Date, amount: number) => {
    if (!customerId || !customerMap.has(customerId)) return
    const cur = byCustomer.get(customerId)
    if (cur) {
      cur.dealCount += 1
      cur.totalAmount += amount
      if (date > cur.lastDealAt) {
        cur.lastDealAt = date
        cur.lastDealAmount = amount
      }
    } else {
      byCustomer.set(customerId, { lastDealAt: date, lastDealAmount: amount, dealCount: 1, totalAmount: amount })
    }
  }
  wonOpps.forEach((o) => record(o.customerId, o.closedAt || o.updatedAt, o.amount))
  completedOrders.forEach((o) => record(o.customerId, o.updatedAt, o.totalAmount))

  const now = Date.now()
  const rows: RepurchaseRow[] = [...byCustomer.entries()].map(([customerId, agg]) => {
    const c = customerMap.get(customerId)!
    const repurchaseMs = agg.lastDealAt.getTime() + cycleDays * 24 * 60 * 60 * 1000
    const daysLeft = Math.ceil((repurchaseMs - now) / (24 * 60 * 60 * 1000))
    return {
      customerId,
      companyName: c.companyName,
      country: c.country || '',
      customerLevel: c.customerLevel,
      ownerName: c.owner?.name || '未分配',
      lastDealAt: agg.lastDealAt.toISOString(),
      lastDealAmount: agg.lastDealAmount,
      dealCount: agg.dealCount,
      totalAmount: agg.totalAmount,
      repurchaseAt: new Date(repurchaseMs).toISOString(),
      daysLeft,
      window: daysLeft < 0 ? 'overdue' : daysLeft <= 30 ? 'near' : 'upcoming',
    }
  })

  rows.sort((a, b) => a.daysLeft - b.daysLeft)

  return NextResponse.json({
    success: true,
    data: rows,
    cycleDays,
    stats: {
      total: rows.length,
      overdue: rows.filter((r) => r.window === 'overdue').length,
      near: rows.filter((r) => r.window === 'near').length,
      totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
    },
  })
}
