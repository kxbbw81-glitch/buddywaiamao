import { assertCustomerScope, assertSampleAccess, scopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'
import { createOrderFromQuoteInTransaction, latestQuoteVersion, quoteById } from './order-routes.mjs'

const STATUSES = new Set(['REQUESTED', 'APPROVED', 'SENT', 'DELIVERED', 'FEEDBACK_RECEIVED', 'CONVERTED', 'CANCELLED'])
const sampleInclude = {
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  product: { select: { id: true, sku: true, name: true, active: true } },
  owner: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
}

function numberValue(value, field, { required = false, min = 0, max = 1_000_000 } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return 0
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 ${min} 到 ${max} 之间的数字。`)
  return Number(number.toFixed(2))
}

function statusValue(value, fallback = 'REQUESTED') {
  const status = text(value || fallback, '样品状态', { required: true, max: 30 })?.toUpperCase()
  if (!STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '样品状态不支持。')
  return status
}

function currencyValue(value) {
  const currency = text(value || 'USD', '币种', { required: true, max: 3 })?.toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'VALIDATION_ERROR', '币种必须为三位 ISO 代码。')
  return currency
}

function jsonObject(value, field) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 8 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `${field} 不能超过 8KB。`)
  return value
}

function createInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '样品申请不能超过 16KB。')
  return {
    customerId: text(body.customerId, '客户', { required: true, max: 64 }),
    productId: text(body.productId, '产品', { required: true, max: 64 }),
    quoteId: text(body.quoteId, '报价', { max: 64 }),
    salesOrderId: text(body.salesOrderId, '订单', { max: 64 }),
    quantity: numberValue(body.quantity ?? 1, '样品数量', { required: true, min: 0.0001, max: 10000 }),
    currency: currencyValue(body.currency),
    estimatedCost: numberValue(body.estimatedCost ?? 0, '样品预计成本'),
    shippingAddress: text(body.shippingAddress, '寄送地址', { max: 1000 }),
    note: text(body.note, '样品备注', { max: 2000 }),
  }
}

function statusInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '样品状态更新不能超过 16KB。')
  return {
    status: statusValue(body.status),
    courier: text(body.courier, '快递/物流', { max: 120 }),
    trackingNo: text(body.trackingNo, '运单号', { max: 120 }),
    feedback: jsonObject(body.feedback, '样品反馈'),
    note: text(body.note, '样品备注', { max: 2000 }),
  }
}

function feedbackApproved(feedback) {
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) return false
  if (feedback.approved === true || feedback.accepted === true) return true
  const value = String(feedback.result || feedback.status || feedback.outcome || '').trim().toUpperCase()
  return ['PASS', 'PASSED', 'APPROVED', 'ACCEPTED', '通过', '合格', '客户认可'].includes(value)
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function customerById(db, id) {
  const customer = await db.customer.findUnique({ where: { id }, include: { owner: { select: { id: true, teamId: true } } } })
  if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
  return customer
}

async function productById(db, id) {
  const product = await db.product.findUnique({ where: { id }, select: { id: true, active: true } })
  if (!product) throw new HttpError(404, 'NOT_FOUND', '产品不存在。')
  if (product.active === false) throw new HttpError(400, 'VALIDATION_ERROR', '产品已停用，不能申请样品。')
  return product
}

async function sampleById(db, actor, id) {
  const sample = await db.sampleRequest.findUnique({ where: { id }, include: sampleInclude })
  if (!sample) throw new HttpError(404, 'NOT_FOUND', '样品申请不存在。')
  assertCustomerScope(actor, sample.customer)
  return sample
}

export async function handleSampleRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/samples') {
    assertSampleAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status') ? statusValue(url.searchParams.get('status')) : null
    const customerId = url.searchParams.get('customerId')
    const customerScope = scopeFor(actor)
    const where = {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(Object.keys(customerScope).length ? { customer: customerScope } : {}),
    }
    const [items, total] = await db.$transaction([db.sampleRequest.findMany({ where, include: sampleInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.sampleRequest.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/samples') {
    assertSampleAccess(actor, true)
    const data = createInput(await readJson(req))
    const customer = await customerById(db, data.customerId)
    assertCustomerScope(actor, customer)
    await productById(db, data.productId)
    const sample = await db.$transaction(async (tx) => {
      const created = await tx.sampleRequest.create({ data: { ...data, status: 'REQUESTED', ownerId: customer.ownerId, createdById: actor.id }, include: sampleInclude })
      await audit(tx, actor, 'CREATE', 'sample_request', created.id, { customerId: data.customerId, productId: data.productId, quoteId: data.quoteId, salesOrderId: data.salesOrderId, quantity: data.quantity })
      return created
    })
    return send(res, 201, { data: sample })
  }

  const sampleMatch = pathname.match(/^\/api\/samples\/([^/]+)$/)
  if (sampleMatch && req.method === 'GET') {
    assertSampleAccess(actor)
    return send(res, 200, { data: await sampleById(db, actor, sampleMatch[1]) })
  }

  const statusMatch = pathname.match(/^\/api\/samples\/([^/]+)\/status$/)
  if (statusMatch && req.method === 'PATCH') {
    assertSampleAccess(actor, true)
    const sample = await sampleById(db, actor, statusMatch[1])
    const data = statusInput(await readJson(req))
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.sampleRequest.update({ where: { id: sample.id }, data: { status: data.status, courier: data.courier ?? sample.courier, trackingNo: data.trackingNo ?? sample.trackingNo, feedback: data.feedback ?? sample.feedback, note: data.note ?? sample.note }, include: sampleInclude })
      await audit(tx, actor, 'UPDATE_STATUS', 'sample_request', sample.id, { from: sample.status, to: data.status, courier: data.courier, trackingNo: data.trackingNo, hasFeedback: Boolean(data.feedback) })
      return row
    })
    return send(res, 200, { data: updated })
  }

  const convertMatch = pathname.match(/^\/api\/samples\/([^/]+)\/convert-to-order$/)
  if (convertMatch && req.method === 'POST') {
    assertSampleAccess(actor, true)
    const sample = await sampleById(db, actor, convertMatch[1])
    if (sample.status === 'CONVERTED' || sample.salesOrderId) throw new HttpError(409, 'SAMPLE_ALREADY_CONVERTED', '样品已关联订单，不能重复转单。')
    if (sample.status !== 'FEEDBACK_RECEIVED') throw new HttpError(400, 'SAMPLE_FEEDBACK_REQUIRED', '样品必须先完成签收后的反馈，再转合同/订单。')
    if (!feedbackApproved(sample.feedback)) throw new HttpError(400, 'SAMPLE_FEEDBACK_NOT_APPROVED', '样品反馈未标记通过或客户认可，不能转合同/订单。')
    if (!sample.quoteId) throw new HttpError(400, 'SAMPLE_QUOTE_REQUIRED', '样品未绑定报价，不能无来源生成订单。')
    const quote = await quoteById(db, actor, sample.quoteId)
    if (quote.customerId !== sample.customerId) throw new HttpError(400, 'SAMPLE_QUOTE_CUSTOMER_MISMATCH', '样品绑定报价与样品客户不一致。')
    const version = await latestQuoteVersion(db, quote.id)
    const { order, updated } = await db.$transaction(async (tx) => {
      const { order } = await createOrderFromQuoteInTransaction(tx, actor, quote, version, { auditAction: 'CREATE_FROM_SAMPLE', auditDetail: { sampleRequestId: sample.id, productId: sample.productId, quantity: sample.quantity }, fulfillmentNote: 'ORDER_CREATED_FROM_SAMPLE' })
      const row = await tx.sampleRequest.update({ where: { id: sample.id }, data: { status: 'CONVERTED', salesOrderId: order.id }, include: sampleInclude })
      await audit(tx, actor, 'CONVERT_TO_ORDER', 'sample_request', sample.id, { salesOrderId: order.id, quoteId: quote.id, productId: sample.productId, quantity: sample.quantity })
      return { order, updated: row }
    })
    return send(res, 201, { data: { sample: updated, order } })
  }

  return false
}
