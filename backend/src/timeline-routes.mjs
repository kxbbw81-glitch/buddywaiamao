import { assertCustomerScope, assertTimelineAccess, scopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const TYPES = new Set(['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'NOTE'])
const DIRECTIONS = new Set(['INBOUND', 'OUTBOUND', 'INTERNAL'])
const timelineInclude = {
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  opportunity: { select: { id: true, name: true, stage: true } },
  owner: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
}

function enumValue(value, field, allowed, fallback) {
  const result = text(value || fallback, field, { required: true, max: 20 })?.toUpperCase()
  if (!allowed.has(result)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不支持。`)
  return result
}

function dateValue(value) {
  if (!value) return new Date()
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', '沟通时间无效。')
  return date
}

function eventInput(body) {
  return {
    customerId: text(body.customerId, '客户', { required: true, max: 64 }),
    opportunityId: text(body.opportunityId, '商机', { max: 64 }),
    type: enumValue(body.type, '沟通类型', TYPES),
    direction: enumValue(body.direction, '沟通方向', DIRECTIONS, 'INTERNAL'),
    summary: text(body.summary, '沟通摘要', { required: true, max: 240 }),
    content: text(body.content, '沟通内容', { max: 4000 }),
    occurredAt: dateValue(body.occurredAt),
  }
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function customerById(db, id) {
  const customer = await db.customer.findUnique({ where: { id }, include: { owner: { select: { id: true, teamId: true } } } })
  if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
  return customer
}

async function opportunityById(db, id) {
  const opportunity = await db.opportunity.findUnique({ where: { id }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } } } })
  if (!opportunity) throw new HttpError(404, 'NOT_FOUND', '商机不存在。')
  return opportunity
}

export async function handleTimelineRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/timeline') {
    assertTimelineAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const type = url.searchParams.get('type')?.toUpperCase()
    if (type && !TYPES.has(type)) throw new HttpError(400, 'VALIDATION_ERROR', '沟通类型不支持。')
    const customerId = url.searchParams.get('customerId')
    const opportunityId = url.searchParams.get('opportunityId')
    const customerScope = scopeFor(actor)
    const where = {
      ...(type ? { type } : {}),
      ...(customerId ? { customerId } : {}),
      ...(opportunityId ? { opportunityId } : {}),
      ...(Object.keys(customerScope).length ? { customer: customerScope } : {}),
    }
    const [items, total] = await db.$transaction([db.communicationEvent.findMany({ where, include: timelineInclude, orderBy: { occurredAt: 'desc' }, skip, take: pageSize }), db.communicationEvent.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/timeline') {
    assertTimelineAccess(actor, true)
    const data = eventInput(await readJson(req))
    const customer = await customerById(db, data.customerId)
    assertCustomerScope(actor, customer)
    if (data.opportunityId) {
      const opportunity = await opportunityById(db, data.opportunityId)
      if (opportunity.customerId !== customer.id) throw new HttpError(400, 'VALIDATION_ERROR', '商机不属于所选客户。')
      assertCustomerScope(actor, opportunity.customer)
    }
    const event = await db.$transaction(async (tx) => {
      const created = await tx.communicationEvent.create({ data: { ...data, ownerId: customer.ownerId, createdById: actor.id }, include: timelineInclude })
      await audit(tx, actor, 'CREATE', 'communication_event', created.id, { customerId: data.customerId, opportunityId: data.opportunityId, type: data.type })
      return created
    })
    return send(res, 201, { data: event })
  }

  return false
}
