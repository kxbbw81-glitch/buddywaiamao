import { createHash } from 'node:crypto'
import { assertCustomerScope, assertTradeDocumentAccess, orderScopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const DOCUMENT_TYPES = new Set(['PI', 'CI', 'PL', 'SC'])
const DOCUMENT_STATUSES = new Set(['GENERATED', 'APPROVED', 'REJECTED'])
const REVIEW_STATUSES = new Set(['APPROVED', 'REJECTED'])

const documentInclude = {
  salesOrder: {
    include: {
      customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
      owner: { select: { id: true, name: true } },
    },
  },
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
}

function documentType(value) {
  const type = text(value, '单证类型', { required: true, max: 8 })?.toUpperCase()
  if (!DOCUMENT_TYPES.has(type)) throw new HttpError(400, 'VALIDATION_ERROR', '单证类型仅支持 PI、CI、PL、SC。')
  return type
}

function reviewStatus(value) {
  const status = text(value, '审核状态', { required: true, max: 16 })?.toUpperCase()
  if (!REVIEW_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '审核状态仅支持 APPROVED 或 REJECTED。')
  return status
}

function statusFilter(value) {
  const status = text(value, '单证状态', { required: true, max: 16 })?.toUpperCase()
  if (!DOCUMENT_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '单证状态不支持。')
  return status
}

function money(value, field) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为非负数字。`)
  return Number(number.toFixed(2))
}

function assertNoManualFinancialOverride(body) {
  const forbidden = ['totalAmount', 'amount', 'items', 'currency', 'customerName']
  const found = forbidden.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
  if (found.length) throw new HttpError(400, 'DOCUMENT_SOURCE_LOCKED', `单证金额、币种、客户和明细必须来自已确认业务数据，不能手工覆盖：${found.join(', ')}。`)
}

function sourceHash(source) {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex')
}

function documentNo(order, type, version) {
  const safeOrderNo = String(order.orderNo || order.id).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40)
  return `${type}-${safeOrderNo}-V${version}`
}

function itemSnapshot(items) {
  return items.map((item, index) => ({
    lineNo: index + 1,
    productId: item.productId || null,
    sku: item.sku || null,
    name: item.name,
    quantity: money(item.quantity, `第 ${index + 1} 行数量`),
    unitPrice: money(item.unitPrice, `第 ${index + 1} 行单价`),
    amount: money(item.amount, `第 ${index + 1} 行金额`),
    packing: item.snapshot?.packing || item.snapshot?.packaging || null,
    weight: item.snapshot?.weight || item.snapshot?.grossWeight || null,
  }))
}

function confirmedPaid(payments) {
  return Number(payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + money(payment.amount, '确认收款金额'), 0).toFixed(2))
}

function approvedTypes(documents) {
  return [...new Set(documents.filter((document) => document.status === 'APPROVED').map((document) => document.type))]
}

function buildConsistency({ order, items, payments, documents = [], type }) {
  const totalAmount = money(order.totalAmount, '订单金额')
  const itemTotal = Number(items.reduce((sum, item) => sum + money(item.amount, '订单行金额'), 0).toFixed(2))
  const paidAmount = confirmedPaid(payments)
  const approved = approvedTypes(documents)
  const blockers = []
  const warnings = []

  if (!items.length) blockers.push('ORDER_ITEMS_REQUIRED')
  if (Math.abs(itemTotal - totalAmount) > 0.01) blockers.push('ORDER_TOTAL_MISMATCH')
  if (!order.customer?.name) blockers.push('CUSTOMER_REQUIRED')
  if (type === 'PL' && items.some((item) => !item.snapshot?.packing && !item.snapshot?.packaging)) warnings.push('PACKING_SOURCE_MISSING')
  if (type === 'PL' && items.some((item) => !item.snapshot?.weight && !item.snapshot?.grossWeight)) warnings.push('WEIGHT_SOURCE_MISSING')
  if (['CI', 'PL'].includes(type) && paidAmount <= 0) warnings.push('NO_CONFIRMED_PAYMENT_YET')

  const readyToShipBlockers = []
  if (!approved.includes('CI')) readyToShipBlockers.push('NEED_APPROVED_CI')
  if (!approved.includes('PL')) readyToShipBlockers.push('NEED_APPROVED_PL')
  if (!approved.includes('PI') && !approved.includes('SC')) readyToShipBlockers.push('NEED_APPROVED_PI_OR_SC')
  if (paidAmount < totalAmount) readyToShipBlockers.push('WAITING_FULL_PAYMENT_CONFIRMATION')

  return {
    blockers,
    warnings,
    orderTotal: totalAmount,
    itemTotal,
    paidAmount: Math.min(paidAmount, totalAmount),
    pendingAmount: Number(Math.max(totalAmount - paidAmount, 0).toFixed(2)),
    approvedDocumentTypes: approved,
    readyToShip: readyToShipBlockers.length === 0,
    readyToShipBlockers,
  }
}

function buildSnapshot({ order, items, payments, documents, type, templateCode, note }) {
  const consistency = buildConsistency({ order, items, payments, documents, type })
  return {
    type,
    templateCode: templateCode || 'V2_DEFAULT',
    sourcePolicy: 'ORDER_CUSTOMER_ITEMS_CONFIRMED_PAYMENTS_ONLY',
    order: { id: order.id, orderNo: order.orderNo, status: order.status, currency: order.currency, totalAmount: money(order.totalAmount, '订单金额') },
    customer: { id: order.customerId, name: order.customer?.name, country: order.customer?.country || null },
    items: itemSnapshot(items),
    payment: { confirmedAmount: consistency.paidAmount, pendingAmount: consistency.pendingAmount },
    consistency,
    note: note || null,
  }
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

async function documentById(db, actor, id, { write = false } = {}) {
  const document = await db.tradeDocument.findUnique({ where: { id }, include: documentInclude })
  if (!document) throw new HttpError(404, 'NOT_FOUND', '单证不存在。')
  if (!['ADMIN', 'FINANCE'].includes(actor.role) && !(actor.role === 'EXEC' && !write)) assertCustomerScope(actor, document.customer)
  return document
}

async function orderSources(db, order) {
  const [items, payments, documents] = await db.$transaction([
    db.orderItem.findMany({ where: { salesOrderId: order.id }, orderBy: { id: 'asc' }, take: 200 }),
    db.orderPayment.findMany({ where: { salesOrderId: order.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.tradeDocument.findMany({ where: { salesOrderId: order.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ])
  return { items, payments, documents }
}

export async function handleTradeDocumentRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/trade-documents') {
    assertTradeDocumentAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status') ? statusFilter(url.searchParams.get('status')) : null
    const type = url.searchParams.get('type') ? documentType(url.searchParams.get('type')) : null
    const salesOrderId = url.searchParams.get('orderId') || url.searchParams.get('salesOrderId')
    const scope = orderScopeFor(actor)
    const where = { ...(status ? { status } : {}), ...(type ? { type } : {}), ...(salesOrderId ? { salesOrderId } : {}), ...(Object.keys(scope).length ? { salesOrder: { customer: scope } } : {}) }
    const [items, total] = await db.$transaction([db.tradeDocument.findMany({ where, include: documentInclude, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.tradeDocument.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  const generateMatch = pathname.match(/^\/api\/orders\/([^/]+)\/documents\/generate$/)
  if (generateMatch && req.method === 'POST') {
    assertTradeDocumentAccess(actor, 'write')
    const body = await readJson(req)
    assertNoManualFinancialOverride(body)
    const type = documentType(body.type)
    const templateCode = text(body.templateCode || 'V2_DEFAULT', '模板代码', { max: 80 })
    const note = text(body.note, '单证备注', { max: 2000 })
    const order = await orderById(db, actor, generateMatch[1], { write: true })
    const { items, payments, documents } = await orderSources(db, order)
    const snapshot = buildSnapshot({ order, items, payments, documents, type, templateCode, note })
    if (snapshot.consistency.blockers.length) throw new HttpError(400, 'DOCUMENT_SOURCE_INVALID', '订单当前数据不足以生成可信单证。', { blockers: snapshot.consistency.blockers })
    const latest = documents.filter((document) => document.type === type).reduce((max, document) => Math.max(max, Number(document.version || 0)), 0)
    const version = latest + 1
    const document = await db.$transaction(async (tx) => {
      const created = await tx.tradeDocument.create({ data: { salesOrderId: order.id, customerId: order.customerId, type, version, documentNo: documentNo(order, type, version), currency: order.currency, totalAmount: money(order.totalAmount, '订单金额'), snapshot, sourceHash: sourceHash(snapshot), createdById: actor.id }, include: documentInclude })
      await audit(tx, actor, 'GENERATE', 'trade_document', created.id, { salesOrderId: order.id, type, version, sourceHash: created.sourceHash, warnings: snapshot.consistency.warnings })
      return created
    })
    return send(res, 201, { data: document })
  }

  const reconciliationMatch = pathname.match(/^\/api\/orders\/([^/]+)\/reconciliation$/)
  if (reconciliationMatch && req.method === 'GET') {
    assertTradeDocumentAccess(actor)
    const order = await orderById(db, actor, reconciliationMatch[1])
    const { items, payments, documents } = await orderSources(db, order)
    const consistency = buildConsistency({ order, items, payments, documents, type: 'CI' })
    return send(res, 200, { data: { orderId: order.id, orderNo: order.orderNo, currency: order.currency, totalAmount: consistency.orderTotal, paidAmount: consistency.paidAmount, pendingAmount: consistency.pendingAmount, approvedDocumentTypes: consistency.approvedDocumentTypes, readyToShip: consistency.readyToShip, blockers: consistency.readyToShipBlockers, sourceCounts: { items: items.length, payments: payments.length, documents: documents.length } } })
  }

  const documentMatch = pathname.match(/^\/api\/trade-documents\/([^/]+)$/)
  if (documentMatch && req.method === 'GET') {
    assertTradeDocumentAccess(actor)
    return send(res, 200, { data: await documentById(db, actor, documentMatch[1]) })
  }

  const reviewMatch = pathname.match(/^\/api\/trade-documents\/([^/]+)\/review$/)
  if (reviewMatch && req.method === 'POST') {
    assertTradeDocumentAccess(actor, 'review')
    const document = await documentById(db, actor, reviewMatch[1], { write: true })
    if (document.status === 'APPROVED') throw new HttpError(400, 'DOCUMENT_ALREADY_APPROVED', '已审核通过的单证不能静默覆盖；如需修改请生成新版本。')
    const body = await readJson(req)
    const status = reviewStatus(body.status)
    const note = text(body.note, '审核备注', { max: 2000 })
    if (status === 'APPROVED' && document.snapshot?.consistency?.blockers?.length) throw new HttpError(400, 'DOCUMENT_SOURCE_INVALID', '单证仍存在阻断一致性问题，不能审核通过。', { blockers: document.snapshot.consistency.blockers })
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.tradeDocument.update({ where: { id: document.id }, data: { status, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note }, include: documentInclude })
      await audit(tx, actor, 'REVIEW', 'trade_document', document.id, { from: document.status, to: status, note })
      return row
    })
    return send(res, 200, { data: updated })
  }

  return false
}
