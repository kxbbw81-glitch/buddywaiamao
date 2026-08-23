import { assertCustomerScope, assertFulfillmentAccess, orderScopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const FULFILLMENT_TRANSITIONS = new Set(['IN_PRODUCTION', 'READY_TO_SHIP', 'DELIVERED', 'CANCELLED'])
const SHIPMENT_STATUSES = new Set(['SHIPPED', 'DELIVERED'])

const shipmentInclude = {
  salesOrder: {
    include: {
      customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
      owner: { select: { id: true, name: true } },
    },
  },
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  createdBy: { select: { id: true, name: true } },
}

function money(value, field) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为非负数字。`)
  return Number(number.toFixed(2))
}

function dateValue(value, field, { required = true } = {}) {
  if (!value) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 无效。`)
  return date
}

function fulfillmentStatus(value) {
  const status = text(value, '履约状态', { required: true, max: 32 })?.toUpperCase()
  if (!FULFILLMENT_TRANSITIONS.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '履约状态仅支持 IN_PRODUCTION、READY_TO_SHIP、DELIVERED、CANCELLED。')
  return status
}

function shipmentStatus(value) {
  const status = text(value, '物流状态', { required: true, max: 32 })?.toUpperCase()
  if (!SHIPMENT_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '物流状态仅支持 SHIPPED 或 DELIVERED。')
  return status
}

function paidAmount(payments) {
  return Number(payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + money(payment.amount, '确认收款金额'), 0).toFixed(2))
}

function approvedTypes(documents) {
  return [...new Set(documents.filter((document) => document.status === 'APPROVED').map((document) => document.type))]
}

function readyToShipGate(order, items, payments, documents) {
  const totalAmount = money(order.totalAmount, '订单金额')
  const itemTotal = Number(items.reduce((sum, item) => sum + money(item.amount, '订单行金额'), 0).toFixed(2))
  const confirmedPaid = Math.min(paidAmount(payments), totalAmount)
  const approved = approvedTypes(documents)
  const blockers = []
  if (order.status !== 'CONFIRMED') blockers.push('ORDER_NOT_CONFIRMED')
  if (!items.length) blockers.push('ORDER_ITEMS_REQUIRED')
  if (Math.abs(itemTotal - totalAmount) > 0.01) blockers.push('ORDER_TOTAL_MISMATCH')
  if (!approved.includes('CI')) blockers.push('NEED_APPROVED_CI')
  if (!approved.includes('PL')) blockers.push('NEED_APPROVED_PL')
  if (!approved.includes('PI') && !approved.includes('SC')) blockers.push('NEED_APPROVED_PI_OR_SC')
  if (confirmedPaid < totalAmount) blockers.push('WAITING_FULL_PAYMENT_CONFIRMATION')
  return { ready: blockers.length === 0, blockers, totalAmount, paidAmount: confirmedPaid, approvedDocumentTypes: approved, itemTotal }
}

function productionGate(order, payments) {
  const confirmedPaid = paidAmount(payments)
  const blockers = []
  if (order.status !== 'CONFIRMED') blockers.push('ORDER_NOT_CONFIRMED')
  if (confirmedPaid <= 0) blockers.push('WAITING_PAYMENT_CONFIRMATION')
  return { ready: blockers.length === 0, blockers, paidAmount: confirmedPaid }
}

function shipmentInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '物流记录不能超过 16KB。')
  const data = {
    transportMode: text(body.transportMode, '运输方式', { required: true, max: 80 }),
    carrier: text(body.carrier, '承运方', { max: 120 }),
    trackingNo: text(body.trackingNo, '跟踪号', { max: 120 }),
    bookingNo: text(body.bookingNo, '订舱号', { max: 120 }),
    billOfLadingNo: text(body.billOfLadingNo, '提单号', { max: 120 }),
    containerNo: text(body.containerNo, '柜号', { max: 120 }),
    etd: dateValue(body.etd, 'ETD'),
    atd: dateValue(body.atd, 'ATD'),
    eta: dateValue(body.eta, 'ETA', { required: false }),
    note: text(body.note, '物流备注', { max: 2000 }),
  }
  if (!data.trackingNo && !data.bookingNo && !data.billOfLadingNo && !data.containerNo) throw new HttpError(400, 'VALIDATION_ERROR', '发货前必须记录跟踪号、订舱号、提单号或柜号中的至少一个。')
  return data
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function orderById(db, actor, id, { write = false } = {}) {
  const order = await db.salesOrder.findUnique({ where: { id }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } }, owner: { select: { id: true, name: true } } } })
  if (!order) throw new HttpError(404, 'NOT_FOUND', '订单不存在。')
  if (!['ADMIN', 'FINANCE'].includes(actor.role) && !(actor.role === 'EXEC' && !write)) assertCustomerScope(actor, order.customer)
  return order
}

async function shipmentById(db, actor, id, { write = false } = {}) {
  const shipment = await db.shipment.findUnique({ where: { id }, include: shipmentInclude })
  if (!shipment) throw new HttpError(404, 'NOT_FOUND', '物流记录不存在。')
  if (!['ADMIN', 'FINANCE'].includes(actor.role) && !(actor.role === 'EXEC' && !write)) assertCustomerScope(actor, shipment.customer)
  return shipment
}

async function orderSources(db, order) {
  const [items, payments, documents, shipments] = await db.$transaction([
    db.orderItem.findMany({ where: { salesOrderId: order.id }, orderBy: { id: 'asc' }, take: 200 }),
    db.orderPayment.findMany({ where: { salesOrderId: order.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.tradeDocument.findMany({ where: { salesOrderId: order.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.shipment.findMany({ where: { salesOrderId: order.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])
  return { items, payments, documents, shipments }
}

export async function handleFulfillmentRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/shipments') {
    assertFulfillmentAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status') ? shipmentStatus(url.searchParams.get('status')) : null
    const salesOrderId = url.searchParams.get('orderId') || url.searchParams.get('salesOrderId')
    const scope = orderScopeFor(actor)
    const where = { ...(status ? { status } : {}), ...(salesOrderId ? { salesOrderId } : {}), ...(Object.keys(scope).length ? { salesOrder: { customer: scope } } : {}) }
    const [items, total] = await db.$transaction([db.shipment.findMany({ where, include: shipmentInclude, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.shipment.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  const statusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/fulfillment\/status$/)
  if (statusMatch && req.method === 'PATCH') {
    assertFulfillmentAccess(actor, true)
    const body = await readJson(req)
    const status = fulfillmentStatus(body.status)
    const note = text(body.note, '履约备注', { max: 2000 })
    const order = await orderById(db, actor, statusMatch[1], { write: true })
    const { items, payments, documents, shipments } = await orderSources(db, order)
    if (status === 'IN_PRODUCTION') {
      const gate = productionGate(order, payments)
      if (!gate.ready) throw new HttpError(400, 'FULFILLMENT_GATE_BLOCKED', '收款未达到生产/备货解锁条件。', { blockers: gate.blockers })
    }
    if (status === 'READY_TO_SHIP') {
      const gate = readyToShipGate(order, items, payments, documents)
      if (!gate.ready) throw new HttpError(400, 'FULFILLMENT_GATE_BLOCKED', '订单未满足待发货门禁。', { blockers: gate.blockers })
    }
    if (status === 'DELIVERED' && !shipments.some((shipment) => ['SHIPPED', 'DELIVERED'].includes(shipment.status))) throw new HttpError(400, 'FULFILLMENT_GATE_BLOCKED', '签收前必须已有物流发货记录。', { blockers: ['SHIPMENT_REQUIRED'] })
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.salesOrder.update({ where: { id: order.id }, data: { fulfillmentStatus: status } })
      const event = await tx.fulfillmentEvent.create({ data: { salesOrderId: order.id, type: status, note: note || `FULFILLMENT_${status}`, createdById: actor.id } })
      await audit(tx, actor, 'UPDATE_STATUS', 'sales_order_fulfillment', order.id, { from: order.fulfillmentStatus, to: status, eventId: event.id })
      return row
    })
    return send(res, 200, { data: updated })
  }

  const shipmentCreateMatch = pathname.match(/^\/api\/orders\/([^/]+)\/shipments$/)
  if (shipmentCreateMatch && req.method === 'POST') {
    assertFulfillmentAccess(actor, true)
    const data = shipmentInput(await readJson(req))
    const order = await orderById(db, actor, shipmentCreateMatch[1], { write: true })
    const { items, payments, documents } = await orderSources(db, order)
    const gate = readyToShipGate(order, items, payments, documents)
    if (!gate.ready || order.fulfillmentStatus !== 'READY_TO_SHIP') {
      const blockers = [...gate.blockers]
      if (order.fulfillmentStatus !== 'READY_TO_SHIP') blockers.push('ORDER_NOT_READY_TO_SHIP')
      throw new HttpError(400, 'SHIPMENT_GATE_BLOCKED', '发货前必须满足单证、收款和待发货状态门禁。', { blockers })
    }
    const shipment = await db.$transaction(async (tx) => {
      const created = await tx.shipment.create({ data: { ...data, salesOrderId: order.id, customerId: order.customerId, status: 'SHIPPED', createdById: actor.id }, include: shipmentInclude })
      await tx.salesOrder.update({ where: { id: order.id }, data: { fulfillmentStatus: 'SHIPPED' } })
      const event = await tx.fulfillmentEvent.create({ data: { salesOrderId: order.id, type: 'SHIPPED', note: `SHIPMENT_CREATED:${created.id}`, createdById: actor.id } })
      await audit(tx, actor, 'CREATE', 'shipment', created.id, { salesOrderId: order.id, eventId: event.id, transportMode: data.transportMode, hasReference: true })
      return created
    })
    return send(res, 201, { data: shipment })
  }

  const shipmentStatusMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/status$/)
  if (shipmentStatusMatch && req.method === 'PATCH') {
    assertFulfillmentAccess(actor, true)
    const shipment = await shipmentById(db, actor, shipmentStatusMatch[1], { write: true })
    const body = await readJson(req)
    const status = shipmentStatus(body.status)
    const note = text(body.note, '物流备注', { max: 2000 })
    const deliveredAt = status === 'DELIVERED' ? dateValue(body.deliveredAt || new Date().toISOString(), '签收时间') : shipment.deliveredAt
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.shipment.update({ where: { id: shipment.id }, data: { status, deliveredAt, note: note ?? shipment.note }, include: shipmentInclude })
      if (status === 'DELIVERED') await tx.salesOrder.update({ where: { id: shipment.salesOrderId }, data: { fulfillmentStatus: 'DELIVERED' } })
      const event = await tx.fulfillmentEvent.create({ data: { salesOrderId: shipment.salesOrderId, type: status === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED', note: note || `SHIPMENT_${status}:${shipment.id}`, createdById: actor.id } })
      await audit(tx, actor, 'UPDATE_STATUS', 'shipment', shipment.id, { from: shipment.status, to: status, eventId: event.id })
      return row
    })
    return send(res, 200, { data: updated })
  }

  return false
}
