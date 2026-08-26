import { assertCrmAccess, assertCustomerScope, scopeFor } from './access.mjs'
import { findDuplicateCustomers, fingerprintsFromContact, fingerprintsFromCustomer, fingerprintsFromDedupeInput, registerCustomerFingerprints } from './customer-fingerprint.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'
import { prepareEncryptedContact, publicPiiStorageSummary, revealEncryptedContact } from './pii.mjs'

const STAGES = new Set(['NEW', 'QUOTED', 'SAMPLE', 'NEGOTIATION', 'WON', 'LOST'])
const FOLLOW_UP_TYPES = new Set(['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'NOTE'])
const customerInclude = { owner: { select: { id: true, name: true, teamId: true } }, _count: { select: { contacts: true, opportunities: true } } }
const opportunityInclude = { customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } }, owner: { select: { id: true, name: true } } }

function customerInput(body) {
  return { name: text(body.name, '客户名称', { required: true, max: 160 }), country: text(body.country, '国家', { max: 80 }), website: text(body.website, '官网', { max: 255 }) }
}
function contactInput(body) {
  const email = text(body.email, '邮箱', { max: 160 })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'VALIDATION_ERROR', '邮箱格式不正确。')
  return { name: text(body.name, '联系人姓名', { required: true, max: 120 }), title: text(body.title, '职位', { max: 120 }), email, phone: text(body.phone, '电话', { max: 64 }) }
}
function opportunityInput(body) {
  const amount = body.amount == null || body.amount === '' ? null : Number(body.amount)
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) throw new HttpError(400, 'VALIDATION_ERROR', '预计金额必须为非负数字。')
  const currency = text(body.currency || 'USD', '币种', { required: true, max: 3 })?.toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'VALIDATION_ERROR', '币种必须为三位 ISO 代码。')
  return { customerId: text(body.customerId, '客户', { required: true, max: 64 }), name: text(body.name, '商机名称', { required: true, max: 160 }), amount, currency }
}
function followUpInput(body) {
  const type = text(body.type, '跟进类型', { required: true, max: 20 })?.toUpperCase()
  if (!FOLLOW_UP_TYPES.has(type)) throw new HttpError(400, 'VALIDATION_ERROR', '跟进类型不支持。')
  let dueAt = null
  if (body.dueAt) { dueAt = new Date(body.dueAt); if (Number.isNaN(dueAt.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', '跟进时间无效。') }
  return { type, content: text(body.content, '跟进内容', { required: true, max: 4000 }), dueAt }
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

export async function handleCrmRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/customers') {
    assertCrmAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const where = scopeFor(actor)
    const [items, total] = await db.$transaction([db.customer.findMany({ where, include: customerInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.customer.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }
  if (req.method === 'POST' && pathname === '/api/customers') {
    assertCrmAccess(actor, true)
    const body = await readJson(req)
    const data = customerInput(body)
    const fingerprints = fingerprintsFromCustomer(data, 'CUSTOMER_CREATE')
    const duplicates = await findDuplicateCustomers(db, fingerprints, { customerScope: scopeFor(actor) })
    if (duplicates.length && body.duplicateCheckConfirmed !== true) {
      return send(res, 409, { error: { code: 'DUPLICATE_CHECK_REQUIRED', message: '发现客户指纹重复，创建客户前需要人工确认。' }, data: { fingerprints, candidates: duplicates } })
    }
    const customer = await db.$transaction(async (tx) => {
      const item = await tx.customer.create({ data: { ...data, ownerId: actor.id }, include: customerInclude })
      const createdFingerprints = await registerCustomerFingerprints(tx, item.id, fingerprints, 'CUSTOMER_CREATE')
      await audit(tx, actor, 'CREATE', 'customer', item.id, { fields: Object.keys(data), fingerprintCount: createdFingerprints.length, duplicateCheckConfirmed: body.duplicateCheckConfirmed === true })
      return item
    })
    return send(res, 201, { data: customer })
  }

  if (req.method === 'POST' && pathname === '/api/tools/dedupe') {
    assertCrmAccess(actor)
    const body = await readJson(req)
    const fingerprints = fingerprintsFromDedupeInput(body)
    const candidates = await findDuplicateCustomers(db, fingerprints, { customerScope: scopeFor(actor) })
    return send(res, 200, { data: { fingerprints, candidates, hasDuplicates: candidates.length > 0 } })
  }

  const customerMatch = pathname.match(/^\/api\/customers\/([^/]+)(?:\/profile)?$/)
  if (customerMatch && req.method === 'GET' && pathname === `/api/customers/${customerMatch[1]}`) {
    assertCrmAccess(actor); const item = await customerById(db, customerMatch[1]); assertCustomerScope(actor, item)
    return send(res, 200, { data: await db.customer.findUnique({ where: { id: item.id }, include: { ...customerInclude, opportunities: { orderBy: { updatedAt: 'desc' }, take: 20 } } }) })
  }
  if (customerMatch && req.method === 'PUT') {
    assertCrmAccess(actor, true); const current = await customerById(db, customerMatch[1]); assertCustomerScope(actor, current); const data = customerInput(await readJson(req))
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.customer.update({ where: { id: current.id }, data, include: customerInclude })
      const createdFingerprints = await registerCustomerFingerprints(tx, current.id, fingerprintsFromCustomer(data, 'CUSTOMER_UPDATE'), 'CUSTOMER_UPDATE')
      await audit(tx, actor, 'UPDATE', 'customer', current.id, { fields: Object.keys(data), fingerprintCount: createdFingerprints.length })
      return updated
    })
    return send(res, 200, { data: item })
  }

  const contactsMatch = pathname.match(/^\/api\/customers\/([^/]+)\/contacts$/)
  if (contactsMatch && req.method === 'GET') {
    assertCrmAccess(actor); const customer = await customerById(db, contactsMatch[1]); assertCustomerScope(actor, customer); const { page, pageSize, skip } = listQuery(url)
    const where = { customerId: customer.id }
    const [items, total] = await db.$transaction([db.contact.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.contact.count({ where })])
    return send(res, 200, { data: { items: items.map(revealEncryptedContact), page, pageSize, total } })
  }
  if (contactsMatch && req.method === 'POST') {
    assertCrmAccess(actor, true); const customer = await customerById(db, contactsMatch[1]); assertCustomerScope(actor, customer); const data = contactInput(await readJson(req))
    const item = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({ data: { ...prepareEncryptedContact(data), customerId: customer.id } })
      const createdFingerprints = await registerCustomerFingerprints(tx, customer.id, fingerprintsFromContact(data, 'CONTACT_CREATE'), 'CONTACT_CREATE')
      await audit(tx, actor, 'CREATE', 'contact', created.id, { customerId: customer.id, fingerprintCount: createdFingerprints.length, pii: publicPiiStorageSummary(created) })
      return revealEncryptedContact(created)
    })
    return send(res, 201, { data: item })
  }

  if (req.method === 'GET' && pathname === '/api/opportunities') {
    assertCrmAccess(actor); const { page, pageSize, skip } = listQuery(url); const base = scopeFor(actor); const stage = url.searchParams.get('stage')
    if (stage && !STAGES.has(stage)) throw new HttpError(400, 'VALIDATION_ERROR', '商机阶段不支持。')
    const where = stage ? { AND: [base, { stage }] } : base
    const [items, total] = await db.$transaction([db.opportunity.findMany({ where, include: opportunityInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.opportunity.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }
  if (req.method === 'POST' && pathname === '/api/opportunities') {
    assertCrmAccess(actor, true); const data = opportunityInput(await readJson(req)); const customer = await customerById(db, data.customerId); assertCustomerScope(actor, customer)
    const item = await db.$transaction(async (tx) => { const created = await tx.opportunity.create({ data: { ...data, ownerId: actor.id }, include: opportunityInclude }); await audit(tx, actor, 'CREATE', 'opportunity', created.id, { customerId: data.customerId }); return created })
    return send(res, 201, { data: item })
  }

  const stageMatch = pathname.match(/^\/api\/opportunities\/([^/]+)\/stage$/)
  if (stageMatch && req.method === 'PATCH') {
    assertCrmAccess(actor, true); const current = await opportunityById(db, stageMatch[1]); assertCustomerScope(actor, current.customer); const body = await readJson(req); const stage = text(body.stage, '商机阶段', { required: true, max: 20 })?.toUpperCase()
    if (!STAGES.has(stage)) throw new HttpError(400, 'VALIDATION_ERROR', '商机阶段不支持。')
    const item = await db.$transaction(async (tx) => { const updated = await tx.opportunity.update({ where: { id: current.id }, data: { stage }, include: opportunityInclude }); await audit(tx, actor, 'UPDATE_STAGE', 'opportunity', current.id, { from: current.stage, to: stage }); return updated })
    return send(res, 200, { data: item })
  }

  const followUpMatch = pathname.match(/^\/api\/opportunities\/([^/]+)\/follow-ups$/)
  if (followUpMatch && req.method === 'GET') {
    assertCrmAccess(actor); const opportunity = await opportunityById(db, followUpMatch[1]); assertCustomerScope(actor, opportunity.customer); const { page, pageSize, skip } = listQuery(url)
    const where = { opportunityId: opportunity.id }
    const [items, total] = await db.$transaction([db.followUp.findMany({ where, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.followUp.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }
  if (followUpMatch && req.method === 'POST') {
    assertCrmAccess(actor, true); const opportunity = await opportunityById(db, followUpMatch[1]); assertCustomerScope(actor, opportunity.customer); const data = followUpInput(await readJson(req))
    const item = await db.$transaction(async (tx) => { const created = await tx.followUp.create({ data: { ...data, opportunityId: opportunity.id, authorId: actor.id } }); await audit(tx, actor, 'CREATE', 'follow_up', created.id, { opportunityId: opportunity.id }); return created })
    return send(res, 201, { data: item })
  }
  return false
}
