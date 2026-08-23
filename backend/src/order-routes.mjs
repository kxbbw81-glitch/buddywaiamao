import { assertCustomerScope, assertOrderAccess, orderScopeFor } from './access.mjs'
import { HttpError, listQuery, send } from './http.mjs'

const orderInclude = {
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  quote: { select: { id: true, currency: true, totalAmount: true, status: true } },
  owner: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true, fulfillmentEvents: true } },
}

function orderNo() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `SO-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function money(value, field) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为非负数字。`)
  return Number(number.toFixed(2))
}

function snapshotItems(version) {
  if (!version || !Array.isArray(version.items) || !version.items.length) throw new HttpError(400, 'QUOTE_NOT_CONVERTIBLE', '报价没有可转订单的版本明细。')
  if (Buffer.byteLength(JSON.stringify(version.items), 'utf8') > 48 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '订单明细快照不能超过 48KB。')
  return version.items.map((item, index) => ({
    productId: typeof item.productId === 'string' ? item.productId : null,
    sku: typeof item.sku === 'string' ? item.sku : null,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 160) : `报价行 ${index + 1}`,
    quantity: money(item.quantity ?? 1, `第 ${index + 1} 行数量`),
    unitPrice: money(item.unitPrice ?? 0, `第 ${index + 1} 行单价`),
    unitCost: money(item.unitCost ?? 0, `第 ${index + 1} 行成本`),
    amount: money(item.amount ?? Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0), `第 ${index + 1} 行金额`),
    cost: money(item.cost ?? Number(item.quantity ?? 1) * Number(item.unitCost ?? 0), `第 ${index + 1} 行成本金额`),
    snapshot: item,
  }))
}

function sumConfirmed(payments) {
  return Number(payments.filter((item) => item.status === 'CONFIRMED').reduce((sum, item) => sum + money(item.amount, '收款金额'), 0).toFixed(2))
}

function gateFor(order, payments = []) {
  const totalAmount = money(order.totalAmount, '订单金额')
  const paidAmount = Math.min(sumConfirmed(payments), totalAmount)
  const pendingAmount = Number((totalAmount - paidAmount).toFixed(2))
  const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : order.paymentStatus
  const canShip = order.status === 'CONFIRMED' && paymentStatus === 'PAID' && ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'].includes(order.fulfillmentStatus)
  const requirements = []
  if (paymentStatus !== 'PAID') requirements.push('WAITING_PAYMENT_CONFIRMATION')
  if (!['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'].includes(order.fulfillmentStatus)) requirements.push('WAITING_FULFILLMENT_READY')
  if (order.status !== 'CONFIRMED') requirements.push('ORDER_NOT_CONFIRMED')
  return { orderId: order.id, orderNo: order.orderNo, currency: order.currency, totalAmount, paidAmount, pendingAmount, canShip, paymentStatus, fulfillmentStatus: order.fulfillmentStatus, requirements }
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

export async function quoteById(db, actor, id) {
  const quote = await db.quote.findUnique({ where: { id }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } } } })
  if (!quote) throw new HttpError(404, 'NOT_FOUND', '报价不存在。')
  assertCustomerScope(actor, quote.customer)
  return quote
}

async function orderById(db, actor, id) {
  const order = await db.salesOrder.findUnique({ where: { id }, include: orderInclude })
  if (!order) throw new HttpError(404, 'NOT_FOUND', '订单不存在。')
  if (actor.role !== 'FINANCE') assertCustomerScope(actor, order.customer)
  return order
}

export async function latestQuoteVersion(db, quoteId) {
  const [version] = await db.quoteVersion.findMany({ where: { quoteId }, orderBy: { version: 'desc' }, take: 1 })
  return version
}

export async function createOrderFromQuoteInTransaction(tx, actor, quote, version, { auditAction = 'CREATE_FROM_QUOTE', auditDetail = {}, fulfillmentNote = 'ORDER_CREATED_FROM_QUOTE' } = {}) {
  const items = snapshotItems(version)
  const totalAmount = money(quote.totalAmount, '报价金额')
  const created = await tx.salesOrder.create({ data: { orderNo: orderNo(), customerId: quote.customerId, quoteId: quote.id, currency: quote.currency, totalAmount, createdById: actor.id, ownerId: quote.ownerId }, include: orderInclude })
  for (const item of items) await tx.orderItem.create({ data: { ...item, salesOrderId: created.id } })
  const event = await tx.fulfillmentEvent.create({ data: { salesOrderId: created.id, type: 'PENDING', note: fulfillmentNote, createdById: actor.id } })
  await audit(tx, actor, auditAction, 'sales_order', created.id, { quoteId: quote.id, versionId: version.id, eventId: event.id, totalAmount, itemCount: items.length, ...auditDetail })
  return { order: created, quote, version, itemCount: items.length, totalAmount }
}

export async function createOrderFromQuote(db, actor, quoteId, { auditAction = 'CREATE_FROM_QUOTE', auditDetail = {}, fulfillmentNote = 'ORDER_CREATED_FROM_QUOTE' } = {}) {
  const quote = await quoteById(db, actor, quoteId)
  const version = await latestQuoteVersion(db, quote.id)
  return db.$transaction((tx) => createOrderFromQuoteInTransaction(tx, actor, quote, version, { auditAction, auditDetail, fulfillmentNote }))
}

export async function handleOrderRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/orders') {
    assertOrderAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const customerScope = orderScopeFor(actor)
    const where = Object.keys(customerScope).length ? { customer: customerScope } : {}
    const [items, total] = await db.$transaction([db.salesOrder.findMany({ where, include: orderInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.salesOrder.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  const fromQuoteMatch = pathname.match(/^\/api\/orders\/from-quote\/([^/]+)$/)
  if (fromQuoteMatch && req.method === 'POST') {
    assertOrderAccess(actor, true)
    const { order } = await createOrderFromQuote(db, actor, fromQuoteMatch[1])
    return send(res, 201, { data: order })
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/)
  if (orderMatch && req.method === 'GET') {
    assertOrderAccess(actor)
    const order = await orderById(db, actor, orderMatch[1])
    const items = await db.orderItem.findMany({ where: { salesOrderId: order.id }, orderBy: { id: 'asc' }, take: 100 })
    return send(res, 200, { data: { ...order, items } })
  }

  const gateMatch = pathname.match(/^\/api\/orders\/([^/]+)\/gate$/)
  if (gateMatch && req.method === 'GET') {
    assertOrderAccess(actor)
    const order = await orderById(db, actor, gateMatch[1])
    const payments = await db.orderPayment.findMany({ where: { salesOrderId: order.id }, orderBy: { createdAt: 'desc' }, take: 100 })
    return send(res, 200, { data: gateFor(order, payments) })
  }

  return false
}
