import { assertCustomerScope, assertPaymentAccess, orderScopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const PAYMENT_STATUSES = new Set(['REGISTERED', 'CONFIRMED', 'REJECTED'])
const paymentInclude = {
  salesOrder: {
    include: {
      customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
      owner: { select: { id: true, name: true } },
    },
  },
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  createdBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
}

function currencyValue(value) {
  const currency = text(value || 'USD', '币种', { required: true, max: 3 })?.toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'VALIDATION_ERROR', '币种必须为三位 ISO 代码。')
  return currency
}

function positiveMoney(value, field) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为大于 0 的数字。`)
  return Number(number.toFixed(2))
}

function dateValue(value) {
  if (!value) return new Date()
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', '收款日期无效。')
  return date
}

function confirmedTotal(payments) {
  return Number(payments.filter((item) => item.status === 'CONFIRMED').reduce((sum, item) => sum + positiveMoney(item.amount, '收款金额'), 0).toFixed(2))
}

function paymentStatusFor(order, paidAmount) {
  const totalAmount = positiveMoney(order.totalAmount || 0.01, '订单金额')
  if (paidAmount >= totalAmount) return 'PAID'
  return paidAmount > 0 ? 'PARTIAL' : 'UNPAID'
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function orderById(db, actor, id, { write = false } = {}) {
  const order = await db.salesOrder.findUnique({ where: { id }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } } } })
  if (!order) throw new HttpError(404, 'NOT_FOUND', '订单不存在。')
  if (!['ADMIN', 'FINANCE'].includes(actor.role) && !(actor.role === 'EXEC' && !write)) assertCustomerScope(actor, order.customer)
  return order
}

async function paymentById(db, actor, id, { write = false } = {}) {
  const payment = await db.orderPayment.findUnique({ where: { id }, include: paymentInclude })
  if (!payment) throw new HttpError(404, 'NOT_FOUND', '回款记录不存在。')
  if (!['ADMIN', 'FINANCE'].includes(actor.role) && !(actor.role === 'EXEC' && !write)) assertCustomerScope(actor, payment.customer)
  return payment
}

export async function handlePaymentRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/payments') {
    assertPaymentAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status')?.toUpperCase()
    const salesOrderId = url.searchParams.get('orderId')
    if (status && !PAYMENT_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '回款状态不支持。')
    const scope = orderScopeFor(actor)
    const where = { ...(status ? { status } : {}), ...(salesOrderId ? { salesOrderId } : {}), ...(Object.keys(scope).length ? { salesOrder: { customer: scope } } : {}) }
    const [items, total] = await db.$transaction([db.orderPayment.findMany({ where, include: paymentInclude, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.orderPayment.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/payments') {
    assertPaymentAccess(actor, 'write')
    const body = await readJson(req)
    const salesOrderId = text(body.orderId || body.salesOrderId, '订单', { required: true, max: 64 })
    const order = await orderById(db, actor, salesOrderId, { write: true })
    const amount = positiveMoney(body.amount, '收款金额')
    const currency = currencyValue(body.currency || order.currency)
    if (currency !== order.currency) throw new HttpError(400, 'VALIDATION_ERROR', '收款币种必须与订单币种一致。')
    const payment = await db.$transaction(async (tx) => {
      const created = await tx.orderPayment.create({ data: { salesOrderId: order.id, customerId: order.customerId, amount, currency, receivedAt: dateValue(body.receivedAt), note: text(body.note, '备注', { max: 2000 }), createdById: actor.id }, include: paymentInclude })
      await audit(tx, actor, 'REGISTER', 'order_payment', created.id, { salesOrderId: order.id, amount, currency })
      return created
    })
    return send(res, 201, { data: payment })
  }

  const confirmMatch = pathname.match(/^\/api\/payments\/([^/]+)\/confirm$/)
  if (confirmMatch && req.method === 'POST') {
    assertPaymentAccess(actor, 'confirm')
    const payment = await paymentById(db, actor, confirmMatch[1], { write: true })
    if (payment.status !== 'REGISTERED') throw new HttpError(400, 'INVALID_PAYMENT_STATUS', '仅 REGISTERED 回款可以确认。')
    const result = await db.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id: payment.salesOrderId }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } } } })
      const existing = await tx.orderPayment.findMany({ where: { salesOrderId: payment.salesOrderId, status: 'CONFIRMED' }, take: 100 })
      const nextPaidAmount = Number((confirmedTotal(existing) + positiveMoney(payment.amount, '收款金额')).toFixed(2))
      if (nextPaidAmount > positiveMoney(order.totalAmount, '订单金额')) throw new HttpError(400, 'PAYMENT_EXCEEDS_ORDER_TOTAL', '确认后收款金额不能超过订单总额。')
      const confirmed = await tx.orderPayment.update({ where: { id: payment.id }, data: { status: 'CONFIRMED', confirmedById: actor.id, confirmedAt: new Date() }, include: paymentInclude })
      await tx.salesOrder.update({ where: { id: order.id }, data: { paymentStatus: paymentStatusFor(order, nextPaidAmount) } })
      await audit(tx, actor, 'CONFIRM', 'order_payment', confirmed.id, { salesOrderId: order.id, amount: confirmed.amount, nextPaidAmount })
      return confirmed
    })
    return send(res, 200, { data: result })
  }

  return false
}
