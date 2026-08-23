import { assertCommissionAccess, orderScopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const DEFAULT_RATE = 0.015
const MAX_RATE = 0.5
const RECORD_STATUSES = new Set(['CALCULATED', 'APPROVED', 'REJECTED'])

const recordInclude = {
  sales: { select: { id: true, name: true, email: true, role: true, teamId: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
}

function rateValue(value) {
  const raw = value == null || value === '' ? DEFAULT_RATE : Number(value)
  if (!Number.isFinite(raw) || raw < 0 || raw > MAX_RATE) throw new HttpError(400, 'VALIDATION_ERROR', '提成率必须是 0 到 0.5 之间的数字。')
  return Number(raw.toFixed(6))
}

function money(value, field) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为非负数字。`)
  return Number(number.toFixed(2))
}

function dateRange(urlOrBody) {
  const fromValue = typeof urlOrBody.get === 'function' ? urlOrBody.get('from') : urlOrBody.from
  const toValue = typeof urlOrBody.get === 'function' ? urlOrBody.get('to') : urlOrBody.to
  const from = fromValue ? new Date(fromValue) : null
  const to = toValue ? new Date(toValue) : null
  if (from && Number.isNaN(from.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', 'from 日期无效。')
  if (to && Number.isNaN(to.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', 'to 日期无效。')
  if (to) to.setHours(23, 59, 59, 999)
  if (from && to && from > to) throw new HttpError(400, 'VALIDATION_ERROR', 'from 不能晚于 to。')
  return { from, to }
}

function statusValue(value) {
  const status = text(value, '提成记录状态', { required: true, max: 16 })?.toUpperCase()
  if (!RECORD_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '提成记录状态不支持。')
  return status
}

function periodWhere(range) {
  const where = {}
  if (range.from || range.to) {
    where.createdAt = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    }
  }
  return where
}

function confirmedPaid(payments) {
  return Number(payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + money(payment.amount, '确认回款金额'), 0).toFixed(2))
}

function salesInfo(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId } : { id: 'unassigned', name: '未分配', email: null, role: null, teamId: null }
}

function orderAllowedForActor(actor, order) {
  if (['ADMIN', 'EXEC', 'FINANCE'].includes(actor.role)) return true
  if (actor.role === 'SALES') return order.ownerId === actor.id
  if (actor.role === 'MANAGER') return order.ownerId === actor.id || (actor.teamId && order.owner?.teamId === actor.teamId)
  return false
}

function aggregateOrders({ actor, orders, paymentsByOrder, rate }) {
  const map = new Map()
  for (const order of orders) {
    if (order.status === 'CANCELLED') continue
    if (!orderAllowedForActor(actor, order)) continue
    const salesId = order.ownerId || order.createdById || 'unassigned'
    const key = `${salesId}:${order.currency}`
    const paid = confirmedPaid(paymentsByOrder.get(order.id) || [])
    const total = money(order.totalAmount, '订单金额')
    const existing = map.get(key) || {
      sales: salesInfo(order.owner || order.createdBy),
      salesId,
      currency: order.currency || 'USD',
      orderCount: 0,
      totalAmount: 0,
      confirmedPaidAmount: 0,
      outstandingAmount: 0,
      orderIds: [],
    }
    existing.orderCount += 1
    existing.totalAmount = Number((existing.totalAmount + total).toFixed(2))
    existing.confirmedPaidAmount = Number((existing.confirmedPaidAmount + paid).toFixed(2))
    existing.outstandingAmount = Number((existing.outstandingAmount + Math.max(total - paid, 0)).toFixed(2))
    existing.orderIds.push(order.id)
    map.set(key, existing)
  }
  return [...map.values()].map((row) => ({
    ...row,
    collectionRate: row.totalAmount > 0 ? Number(((row.confirmedPaidAmount / row.totalAmount) * 100).toFixed(1)) : 0,
    commissionAmount: Number((row.confirmedPaidAmount * rate).toFixed(2)),
    potentialCommission: Number((row.totalAmount * rate).toFixed(2)),
  })).sort((a, b) => b.confirmedPaidAmount - a.confirmedPaidAmount)
}

function summaryFor(rows, rate) {
  const totalAmount = Number(rows.reduce((sum, row) => sum + row.totalAmount, 0).toFixed(2))
  const confirmedPaidAmount = Number(rows.reduce((sum, row) => sum + row.confirmedPaidAmount, 0).toFixed(2))
  return {
    salesCount: rows.length,
    orderCount: rows.reduce((sum, row) => sum + row.orderCount, 0),
    totalAmount,
    confirmedPaidAmount,
    outstandingAmount: Number(rows.reduce((sum, row) => sum + row.outstandingAmount, 0).toFixed(2)),
    commissionAmount: Number(rows.reduce((sum, row) => sum + row.commissionAmount, 0).toFixed(2)),
    potentialCommission: Number(rows.reduce((sum, row) => sum + row.potentialCommission, 0).toFixed(2)),
    collectionRate: totalAmount > 0 ? Number(((confirmedPaidAmount / totalAmount) * 100).toFixed(1)) : 0,
    appliedRate: rate,
  }
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function commissionReport(db, actor, { rate, range }) {
  const scope = orderScopeFor(actor)
  const where = { ...periodWhere(range), ...(Object.keys(scope).length ? { customer: scope } : {}) }
  const orders = await db.salesOrder.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true, role: true, teamId: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true, teamId: true } },
      customer: { include: { owner: { select: { id: true, teamId: true } } } },
      quote: { select: { id: true, totalAmount: true, totalCost: true, grossMargin: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  const payments = await db.orderPayment.findMany({ where: { status: 'CONFIRMED', ...(orders.length ? {} : { salesOrderId: '__none__' }) }, orderBy: { createdAt: 'desc' }, take: 5000 })
  const orderIds = new Set(orders.map((order) => order.id))
  const paymentsByOrder = new Map()
  for (const payment of payments) {
    if (!orderIds.has(payment.salesOrderId)) continue
    if (!paymentsByOrder.has(payment.salesOrderId)) paymentsByOrder.set(payment.salesOrderId, [])
    paymentsByOrder.get(payment.salesOrderId).push(payment)
  }
  const rows = aggregateOrders({ actor, orders, paymentsByOrder, rate })
  return { rows, stats: summaryFor(rows, rate), period: { from: range.from?.toISOString() || null, to: range.to?.toISOString() || null }, sourcePolicy: 'CONFIRMED_PAYMENTS_ONLY' }
}

async function recordById(db, actor, id, { write = false } = {}) {
  const record = await db.commissionRecord.findUnique({ where: { id }, include: recordInclude })
  if (!record) throw new HttpError(404, 'NOT_FOUND', '提成记录不存在。')
  if (!['ADMIN', 'EXEC', 'FINANCE'].includes(actor.role) && !(actor.role === 'MANAGER' && actor.teamId && record.sales?.teamId === actor.teamId) && record.salesId !== actor.id) {
    throw new HttpError(403, 'FORBIDDEN', '无权访问该提成记录。')
  }
  if (write && !['ADMIN', 'FINANCE'].includes(actor.role)) throw new HttpError(403, 'FORBIDDEN', '无权修改该提成记录。')
  return record
}

export async function handleCommissionRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/commissions') {
    assertCommissionAccess(actor)
    const rate = rateValue(url.searchParams.get('rate'))
    const range = dateRange(url.searchParams)
    const report = await commissionReport(db, actor, { rate, range })
    return send(res, 200, { data: report })
  }

  if (req.method === 'GET' && pathname === '/api/commission-records') {
    assertCommissionAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status') ? statusValue(url.searchParams.get('status')) : null
    const salesId = url.searchParams.get('salesId')
    const where = { ...(status ? { status } : {}), ...(salesId ? { salesId } : {}), ...(['SALES'].includes(actor.role) ? { salesId: actor.id } : {}) }
    const [items, total] = await db.$transaction([db.commissionRecord.findMany({ where, include: recordInclude, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.commissionRecord.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/commission-records/settle') {
    assertCommissionAccess(actor, 'settle')
    const body = await readJson(req)
    const rate = rateValue(body.rate)
    const range = dateRange(body)
    const report = await commissionReport(db, actor, { rate, range })
    const records = await db.$transaction(async (tx) => {
      const created = []
      for (const row of report.rows) {
        if (row.confirmedPaidAmount <= 0 && row.totalAmount <= 0) continue
        const record = await tx.commissionRecord.create({
          data: {
            salesId: row.salesId,
            currency: row.currency,
            periodStart: range.from,
            periodEnd: range.to,
            rate,
            orderCount: row.orderCount,
            totalAmount: row.totalAmount,
            confirmedPaidAmount: row.confirmedPaidAmount,
            outstandingAmount: row.outstandingAmount,
            commissionAmount: row.commissionAmount,
            potentialCommission: row.potentialCommission,
            status: 'CALCULATED',
            snapshot: { ...row, sourcePolicy: report.sourcePolicy, period: report.period },
            createdById: actor.id,
          },
          include: recordInclude,
        })
        await audit(tx, actor, 'SETTLE', 'commission_record', record.id, { salesId: row.salesId, rate, commissionAmount: row.commissionAmount, orderCount: row.orderCount })
        created.push(record)
      }
      return created
    })
    return send(res, 201, { data: { records, stats: report.stats, period: report.period } })
  }

  const recordMatch = pathname.match(/^\/api\/commission-records\/([^/]+)$/)
  if (recordMatch && req.method === 'GET') {
    assertCommissionAccess(actor)
    return send(res, 200, { data: await recordById(db, actor, recordMatch[1]) })
  }

  const approveMatch = pathname.match(/^\/api\/commission-records\/([^/]+)\/approve$/)
  if (approveMatch && req.method === 'POST') {
    assertCommissionAccess(actor, 'approve')
    const record = await recordById(db, actor, approveMatch[1], { write: true })
    if (record.status !== 'CALCULATED') throw new HttpError(400, 'INVALID_COMMISSION_STATUS', '仅 CALCULATED 提成记录可以审批。')
    const body = await readJson(req)
    const status = statusValue(body.status || 'APPROVED')
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new HttpError(400, 'VALIDATION_ERROR', '审批只能为 APPROVED 或 REJECTED。')
    const note = text(body.note, '审批备注', { max: 2000 })
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.commissionRecord.update({ where: { id: record.id }, data: { status, approvedById: actor.id, approvedAt: new Date(), approvalNote: note }, include: recordInclude })
      await audit(tx, actor, 'APPROVE', 'commission_record', record.id, { from: record.status, to: status, note })
      return row
    })
    return send(res, 200, { data: updated })
  }

  return false
}
