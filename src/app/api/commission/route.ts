import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const FINANCE_ROLES = ['super_admin', 'management', 'sales_manager', 'finance']
const DEFAULT_RATE = 0.015 // 默认提成率 1.5%

/**
 * GET /api/commission?rate=0.015&from=2026-01-01&to=2026-12-31
 * 按销售聚合成交订单与回款，按可配置提成率核算预计提成
 * - finance/manager/super_admin：见全部销售
 * - sales：仅看自己的提成
 * 排除 cancelled 订单
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response
  const user = auth.user

  const { searchParams } = new URL(request.url)
  const rate = Math.max(0, Math.min(0.5, parseFloat(searchParams.get('rate') || '') || DEFAULT_RATE))
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

  const dateRange: Record<string, Date> = {}
  if (fromStr) dateRange.gte = new Date(fromStr)
  if (toStr) { const t = new Date(toStr); t.setHours(23, 59, 59, 999); dateRange.lte = t }

  // sales 仅看自己创建的订单（createdById = 自己）
  const orderWhere: Record<string, unknown> = { status: { not: 'cancelled' } }
  if (user.primaryRole === 'sales') orderWhere.createdById = user.id
  if (Object.keys(dateRange).length) orderWhere.createdAt = dateRange

  // 拉取订单 + 创建人 + 客户
  const orders = await db.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNo: true, totalAmount: true, currency: true,
      paidAmount: true, status: true, createdAt: true, createdById: true,
      customer: { select: { id: true, companyName: true, country: true } },
    },
  })

  // 按销售聚合
  const salesIds = [...new Set(orders.map((o) => o.createdById).filter(Boolean))] as string[]
  const salesUsers = await db.user.findMany({
    where: { id: { in: salesIds } },
    select: { id: true, name: true, email: true, primaryRole: true, department: true },
  })
  const userMap = new Map(salesUsers.map((u) => [u.id, u]))

  // 按币种汇总（默认主币种 USD）
  interface SalesAgg {
    salesId: string
    salesName: string
    salesRole: string
    department: string
    orderCount: number
    totalAmount: number
    totalPaid: number
    outstanding: number
    orderIds: string[]
  }
  const bySales = new Map<string, SalesAgg>()
  const record = (salesId: string | null, o: typeof orders[number]) => {
    const sid = salesId || 'unassigned'
    let agg = bySales.get(sid)
    if (!agg) {
      const u = userMap.get(sid!)
      agg = {
        salesId: sid,
        salesName: u?.name || (sid === 'unassigned' ? '未分配' : '未知销售'),
        salesRole: u?.primaryRole || '',
        department: u?.department || '',
        orderCount: 0, totalAmount: 0, totalPaid: 0, outstanding: 0, orderIds: [],
      }
      bySales.set(sid, agg)
    }
    agg.orderCount += 1
    agg.totalAmount += o.totalAmount
    agg.totalPaid += o.paidAmount
    agg.outstanding += o.totalAmount - o.paidAmount
    agg.orderIds.push(o.id)
  }
  orders.forEach((o) => record(o.createdById, o))

  const rows = [...bySales.values()].map((a) => ({
    ...a,
    collectionRate: a.totalAmount > 0 ? Math.round((a.totalPaid / a.totalAmount) * 1000) / 10 : 0,
    commission: Math.round(a.totalPaid * rate * 100) / 100, // 提成基于已回款金额
    potentialCommission: Math.round(a.totalAmount * rate * 100) / 100, // 潜在提成基于订单总额
  })).sort((x, y) => y.totalAmount - x.totalAmount)

  const stats = {
    salesCount: rows.length,
    orderCount: orders.length,
    totalAmount: Math.round(rows.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
    totalPaid: Math.round(rows.reduce((s, r) => s + r.totalPaid, 0) * 100) / 100,
    outstanding: Math.round(rows.reduce((s, r) => s + r.outstanding, 0) * 100) / 100,
    totalCommission: Math.round(rows.reduce((s, r) => s + r.commission, 0) * 100) / 100,
    collectionRate: rows.reduce((s, r) => s + r.totalAmount, 0) > 0
      ? Math.round((rows.reduce((s, r) => s + r.totalPaid, 0) / rows.reduce((s, r) => s + r.totalAmount, 0)) * 1000) / 10
      : 0,
    appliedRate: rate,
  }

  return NextResponse.json({ success: true, data: { rows, stats } })
}
