import { assertCustomerScope, scopeFor } from './access.mjs'
import { findDuplicateCustomers, fingerprintsFromLead, registerCustomerFingerprints } from './customer-fingerprint.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const READ_ROLES = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
const WRITE_ROLES = new Set(['SALES', 'MANAGER', 'ADMIN'])
const ASSIGN_ROLES = new Set(['MANAGER', 'ADMIN'])
const LEAD_STATUSES = new Set(['NEW', 'RESEARCHING', 'TO_CONTACT', 'CONTACTED', 'REPLIED', 'INQUIRY', 'CONVERTED', 'INVALID', 'PAUSED'])
const INQUIRY_STATUSES = new Set(['NEW', 'ASSIGNED', 'REQUIREMENT_DRAFT', 'QUOTING', 'QUOTED', 'WON', 'LOST', 'ARCHIVED'])
const PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
const FOLLOW_TYPES = new Set(['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'NOTE'])
const DIRECTIONS = new Set(['INBOUND', 'OUTBOUND', 'INTERNAL'])

function assertAcquisitionAccess(actor, write = false) {
  const allowed = write ? WRITE_ROLES : READ_ROLES
  if (!allowed.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或维护获客线索。')
}

function assertAssignAccess(actor) {
  if (!ASSIGN_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权分配线索或询盘。')
}

function upperText(value, field, { required = false, max = 80 } = {}) {
  return text(value, field, { required, max })?.toUpperCase() || null
}

function enumValue(value, allowed, fallback, field) {
  const result = upperText(value || fallback, field, { required: true, max: 80 })
  if (!allowed.has(result)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不在允许范围内。`)
  return result
}

function jsonObject(value, field, { required = false } = {}) {
  if (value == null) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  return value
}

function parseDate(value, field) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不是有效日期。`)
  return date
}

function decimalValue(value, field) {
  if (value == null || value === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是非负数字。`)
  return amount
}

function validateEmail(email) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'VALIDATION_ERROR', '邮箱格式不正确。')
  return email
}

async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function nextCode(db, model, prefix) {
  const total = await db[model].count({ where: {} })
  return `${prefix}-${new Date().getFullYear()}-${String(total + 1).padStart(4, '0')}`
}

async function activeUser(db, id) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, status: true, teamId: true } })
  if (!user || user.status !== 'ACTIVE') throw new HttpError(400, 'INVALID_OWNER', '负责人不存在或已停用。')
  return user
}

function leadScopeFor(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return {}
  if (actor.role === 'SALES') return { ownerId: actor.id }
  if (actor.role === 'MANAGER') return { OR: [{ ownerId: actor.id }, { ownerId: null }, { owner: { teamId: actor.teamId } }] }
  throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问线索。')
}

function inquiryScopeFor(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return {}
  if (actor.role === 'SALES') return { ownerId: actor.id }
  if (actor.role === 'MANAGER') return { OR: [{ ownerId: actor.id }, { ownerId: null }, { owner: { teamId: actor.teamId } }] }
  throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问询盘。')
}

function assertLeadScope(actor, lead) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return
  if (lead.ownerId === actor.id) return
  if (actor.role === 'MANAGER' && lead.ownerId == null) return
  if (actor.role === 'MANAGER' && actor.teamId && lead.owner?.teamId === actor.teamId) return
  throw new HttpError(403, 'FORBIDDEN', '无权访问该线索。')
}

function assertInquiryScope(actor, inquiry) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return
  if (inquiry.ownerId === actor.id) return
  if (actor.role === 'MANAGER' && inquiry.ownerId == null) return
  if (actor.role === 'MANAGER' && actor.teamId && inquiry.owner?.teamId === actor.teamId) return
  throw new HttpError(403, 'FORBIDDEN', '无权访问该询盘。')
}

function leadInput(body) {
  const email = validateEmail(text(body.email, '邮箱', { max: 160 }))
  return {
    source: upperText(body.source || 'MANUAL', '线索来源', { required: true, max: 80 }),
    channel: upperText(body.channel, '渠道', { max: 80 }),
    companyName: text(body.companyName, '公司名称', { required: true, max: 180 }),
    contactName: text(body.contactName, '联系人', { max: 120 }),
    email,
    phone: text(body.phone, '电话', { max: 80 }),
    country: text(body.country, '国家', { max: 80 }),
    language: text(body.language, '语言', { max: 40 }),
    productInterest: jsonObject(body.productInterest, '产品兴趣'),
    estimatedQuantity: text(body.estimatedQuantity, '预计采购量', { max: 120 }),
    buyerRole: text(body.buyerRole, '采购身份', { max: 120 }),
    status: enumValue(body.status, LEAD_STATUSES, 'NEW', '线索状态'),
    priority: enumValue(body.priority, PRIORITIES, 'NORMAL', '优先级'),
  }
}

function followInput(body) {
  return {
    type: enumValue(body.type, FOLLOW_TYPES, 'NOTE', '跟进类型'),
    content: text(body.content, '跟进内容', { required: true, max: 4000 }),
    dueAt: parseDate(body.dueAt, '跟进时间'),
    completedAt: body.completed ? new Date() : null,
  }
}

function inquiryInput(body) {
  return {
    leadId: text(body.leadId, '线索 ID', { max: 120 }),
    customerId: text(body.customerId, '客户 ID', { max: 120 }),
    opportunityId: text(body.opportunityId, '商机 ID', { max: 120 }),
    subject: text(body.subject, '询盘主题', { required: true, max: 220 }),
    content: text(body.content, '询盘正文', { required: true, max: 8000 }),
    source: upperText(body.source || 'MANUAL', '询盘来源', { required: true, max: 80 }),
    channel: upperText(body.channel, '渠道', { max: 80 }),
    language: text(body.language, '语言', { max: 40 }),
    status: enumValue(body.status, INQUIRY_STATUSES, 'NEW', '询盘状态'),
    priority: enumValue(body.priority, PRIORITIES, 'NORMAL', '优先级'),
    requirements: jsonObject(body.requirements, '需求摘要'),
    missingFields: jsonObject(body.missingFields, '缺失字段'),
    aiExtracted: body.aiExtracted === true,
  }
}

function inquiryItemInput(body) {
  return {
    productName: text(body.productName, '产品名称', { required: true, max: 180 }),
    quantity: decimalValue(body.quantity, '数量'),
    unit: text(body.unit, '单位', { max: 40 }),
    specs: jsonObject(body.specs, '规格'),
    notes: text(body.notes, '备注', { max: 1000 }),
  }
}

function messageInput(body) {
  return {
    direction: enumValue(body.direction, DIRECTIONS, 'INBOUND', '消息方向'),
    channel: upperText(body.channel || 'EMAIL', '渠道', { required: true, max: 80 }),
    sender: text(body.sender, '发送人', { max: 160 }),
    content: text(body.content, '消息内容', { required: true, max: 8000 }),
    occurredAt: parseDate(body.occurredAt, '发生时间') || new Date(),
  }
}

async function leadById(db, id) {
  const lead = await db.lead.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, role: true, teamId: true } }, createdBy: { select: { id: true, name: true, role: true, teamId: true } }, _count: { select: { followUps: true, inquiries: true } } } })
  if (!lead) throw new HttpError(404, 'NOT_FOUND', '线索不存在。')
  return lead
}

async function inquiryById(db, id) {
  const inquiry = await db.inquiry.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, role: true, teamId: true } }, createdBy: { select: { id: true, name: true, role: true, teamId: true } }, lead: true, customer: true, opportunity: true, _count: { select: { items: true, messages: true } } } })
  if (!inquiry) throw new HttpError(404, 'NOT_FOUND', '询盘不存在。')
  return inquiry
}

async function customerById(db, id) {
  const customer = await db.customer.findUnique({ where: { id }, include: { owner: { select: { id: true, teamId: true } } } })
  if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
  return customer
}

async function opportunityById(db, id) {
  const opportunity = await db.opportunity.findUnique({ where: { id }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } }, owner: { select: { id: true, teamId: true } } } })
  if (!opportunity) throw new HttpError(404, 'NOT_FOUND', '商机不存在。')
  return opportunity
}

export async function handleAcquisitionRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/leads') {
    assertAcquisitionAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status')?.toUpperCase()
    const base = leadScopeFor(actor)
    const where = status ? { AND: [base, { status }] } : base
    const [items, total] = await db.$transaction([
      db.lead.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize, include: { owner: { select: { id: true, name: true, role: true, teamId: true } }, _count: { select: { followUps: true, inquiries: true } } } }),
      db.lead.count({ where }),
    ])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/leads') {
    assertAcquisitionAccess(actor, true)
    const body = await readJson(req)
    const data = leadInput(body)
    const ownerId = Object.prototype.hasOwnProperty.call(body, 'ownerId') ? text(body.ownerId, '负责人', { max: 120 }) : actor.id
    if (ownerId) await activeUser(db, ownerId)
    if (ownerId && actor.role === 'SALES' && ownerId !== actor.id) throw new HttpError(403, 'FORBIDDEN', '销售只能创建自己的线索。')
    const row = await db.lead.create({ data: { ...data, code: text(body.code, '线索编号', { max: 80 }) || await nextCode(db, 'lead', 'LEAD'), ownerId, createdById: actor.id } })
    await audit(db, actor, 'CREATE', 'lead', row.id, { source: row.source, channel: row.channel, ownerId: row.ownerId })
    return send(res, 201, { data: row })
  }

  const leadFollowMatch = pathname.match(/^\/api\/leads\/([^/]+)\/follow-ups$/)
  if (leadFollowMatch && req.method === 'GET') {
    assertAcquisitionAccess(actor)
    const lead = await leadById(db, leadFollowMatch[1]); assertLeadScope(actor, lead)
    const { page, pageSize, skip } = listQuery(url)
    const where = { leadId: lead.id }
    const [items, total] = await db.$transaction([
      db.leadFollowUp.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { author: { select: { id: true, name: true, role: true, teamId: true } } } }),
      db.leadFollowUp.count({ where }),
    ])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (leadFollowMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true)
    const lead = await leadById(db, leadFollowMatch[1]); assertLeadScope(actor, lead)
    const data = followInput(await readJson(req))
    const row = await db.leadFollowUp.create({ data: { ...data, leadId: lead.id, authorId: actor.id } })
    await audit(db, actor, 'CREATE', 'lead_follow_up', row.id, { leadId: lead.id, type: row.type })
    return send(res, 201, { data: row })
  }

  const leadStatusMatch = pathname.match(/^\/api\/leads\/([^/]+)\/status$/)
  if (leadStatusMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true)
    const lead = await leadById(db, leadStatusMatch[1]); assertLeadScope(actor, lead)
    const body = await readJson(req)
    const status = enumValue(body.status, LEAD_STATUSES, 'NEW', '线索状态')
    const data = { status, invalidReason: status === 'INVALID' ? text(body.invalidReason, '无效原因', { required: true, max: 500 }) : null }
    const row = await db.lead.update({ where: { id: lead.id }, data })
    await audit(db, actor, 'STATUS_CHANGE', 'lead', row.id, { from: lead.status, to: row.status })
    return send(res, 200, { data: row })
  }

  const leadAssignMatch = pathname.match(/^\/api\/leads\/([^/]+)\/assign$/)
  if (leadAssignMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true); assertAssignAccess(actor)
    const lead = await leadById(db, leadAssignMatch[1]); assertLeadScope(actor, lead)
    const body = await readJson(req)
    const ownerId = text(body.ownerId, '负责人', { required: true, max: 120 })
    await activeUser(db, ownerId)
    const row = await db.lead.update({ where: { id: lead.id }, data: { ownerId, status: lead.status === 'NEW' ? 'TO_CONTACT' : lead.status } })
    await audit(db, actor, 'ASSIGN', 'lead', row.id, { from: lead.ownerId, to: row.ownerId })
    return send(res, 200, { data: row })
  }

  const leadConvertMatch = pathname.match(/^\/api\/leads\/([^/]+)\/convert$/)
  if (leadConvertMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true)
    const lead = await leadById(db, leadConvertMatch[1]); assertLeadScope(actor, lead)
    if (lead.status === 'CONVERTED') throw new HttpError(400, 'LEAD_ALREADY_CONVERTED', '该线索已经转客户。')
    const body = await readJson(req)
    const existingCustomerId = text(body.customerId, '客户 ID', { max: 120 })
    const fingerprints = fingerprintsFromLead(lead, 'LEAD_CONVERT')
    const candidates = existingCustomerId ? [] : await findDuplicateCustomers(db, fingerprints)
    if (!existingCustomerId && candidates.length && body.duplicateCheckConfirmed !== true) {
      return send(res, 409, { error: { code: 'DUPLICATE_CHECK_REQUIRED', message: '发现客户指纹重复，转客户前需要人工确认或指定现有客户。' }, data: { fingerprints, candidates } })
    }
    const result = await db.$transaction(async (tx) => {
      let customer
      if (existingCustomerId) {
        customer = await tx.customer.findUnique({ where: { id: existingCustomerId }, include: { owner: { select: { id: true, teamId: true } } } })
        if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
        assertCustomerScope(actor, customer)
        await registerCustomerFingerprints(tx, customer.id, fingerprints, 'LEAD_CONVERT_EXISTING')
      } else {
        customer = await tx.customer.create({ data: { name: lead.companyName, country: lead.country, ownerId: lead.ownerId || actor.id } })
        if (lead.contactName || lead.email || lead.phone) await tx.contact.create({ data: { customerId: customer.id, name: lead.contactName || 'Unknown Contact', email: lead.email, phone: lead.phone } })
        await registerCustomerFingerprints(tx, customer.id, fingerprints, 'LEAD_CONVERT')
      }
      let opportunity = null
      if (body.createOpportunity !== false) {
        const amount = decimalValue(body.amount, '预计金额')
        opportunity = await tx.opportunity.create({ data: { customerId: customer.id, ownerId: lead.ownerId || actor.id, name: text(body.opportunityName || `${lead.companyName} 询盘商机`, '商机名称', { required: true, max: 160 }), amount, currency: upperText(body.currency || 'USD', '币种', { required: true, max: 3 }) } })
      }
      const updated = await tx.lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED', convertedCustomerId: customer.id, convertedOpportunityId: opportunity?.id || null, convertedAt: new Date() } })
      await audit(tx, actor, 'CONVERT', 'lead', lead.id, { customerId: customer.id, opportunityId: opportunity?.id || null, fingerprintCount: fingerprints.length, duplicateCheckConfirmed: body.duplicateCheckConfirmed === true || Boolean(existingCustomerId) })
      return { lead: updated, customer, opportunity }
    })
    return send(res, 200, { data: result })
  }

  const leadDetailMatch = pathname.match(/^\/api\/leads\/([^/]+)$/)
  if (leadDetailMatch && req.method === 'GET') {
    assertAcquisitionAccess(actor)
    const lead = await leadById(db, leadDetailMatch[1]); assertLeadScope(actor, lead)
    return send(res, 200, { data: lead })
  }

  if (req.method === 'GET' && pathname === '/api/inquiries') {
    assertAcquisitionAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status')?.toUpperCase()
    const base = inquiryScopeFor(actor)
    const where = status ? { AND: [base, { status }] } : base
    const [items, total] = await db.$transaction([
      db.inquiry.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize, include: { owner: { select: { id: true, name: true, role: true, teamId: true } }, lead: true, customer: true, _count: { select: { items: true, messages: true } } } }),
      db.inquiry.count({ where }),
    ])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/inquiries') {
    assertAcquisitionAccess(actor, true)
    const body = await readJson(req)
    const data = inquiryInput(body)
    let lead = null
    let customer = null
    let opportunity = null
    if (data.leadId) { lead = await leadById(db, data.leadId); assertLeadScope(actor, lead) }
    if (data.customerId) { customer = await customerById(db, data.customerId); assertCustomerScope(actor, customer) }
    if (data.opportunityId) { opportunity = await opportunityById(db, data.opportunityId); assertCustomerScope(actor, opportunity.customer); customer ||= opportunity.customer }
    const items = Array.isArray(body.items) ? body.items.slice(0, 50).map(inquiryItemInput) : []
    const row = await db.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({ data: { ...data, code: text(body.code, '询盘编号', { max: 80 }) || await nextCode(tx, 'inquiry', 'INQ'), customerId: customer?.id || data.customerId || null, opportunityId: opportunity?.id || data.opportunityId || null, ownerId: lead?.ownerId || customer?.ownerId || actor.id, createdById: actor.id } })
      for (const item of items) await tx.inquiryItem.create({ data: { ...item, inquiryId: inquiry.id } })
      if (lead) await tx.lead.update({ where: { id: lead.id }, data: { status: lead.status === 'CONVERTED' ? lead.status : 'INQUIRY' } })
      await audit(tx, actor, 'CREATE', 'inquiry', inquiry.id, { leadId: lead?.id || null, customerId: customer?.id || null, itemCount: items.length, aiExtracted: inquiry.aiExtracted })
      return inquiry
    })
    return send(res, 201, { data: row })
  }

  const inquiryStatusMatch = pathname.match(/^\/api\/inquiries\/([^/]+)\/status$/)
  if (inquiryStatusMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true)
    const inquiry = await inquiryById(db, inquiryStatusMatch[1]); assertInquiryScope(actor, inquiry)
    const body = await readJson(req)
    const status = enumValue(body.status, INQUIRY_STATUSES, 'NEW', '询盘状态')
    const row = await db.inquiry.update({ where: { id: inquiry.id }, data: { status } })
    await audit(db, actor, 'STATUS_CHANGE', 'inquiry', row.id, { from: inquiry.status, to: row.status })
    return send(res, 200, { data: row })
  }

  const inquiryItemsMatch = pathname.match(/^\/api\/inquiries\/([^/]+)\/items$/)
  if (inquiryItemsMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true)
    const inquiry = await inquiryById(db, inquiryItemsMatch[1]); assertInquiryScope(actor, inquiry)
    const row = await db.inquiryItem.create({ data: { ...inquiryItemInput(await readJson(req)), inquiryId: inquiry.id } })
    await audit(db, actor, 'CREATE', 'inquiry_item', row.id, { inquiryId: inquiry.id })
    return send(res, 201, { data: row })
  }

  const inquiryMessagesMatch = pathname.match(/^\/api\/inquiries\/([^/]+)\/messages$/)
  if (inquiryMessagesMatch && req.method === 'POST') {
    assertAcquisitionAccess(actor, true)
    const inquiry = await inquiryById(db, inquiryMessagesMatch[1]); assertInquiryScope(actor, inquiry)
    const row = await db.channelMessage.create({ data: { ...messageInput(await readJson(req)), inquiryId: inquiry.id, createdById: actor.id } })
    await audit(db, actor, 'CREATE', 'channel_message', row.id, { inquiryId: inquiry.id, channel: row.channel, direction: row.direction })
    return send(res, 201, { data: row })
  }

  const inquiryDetailMatch = pathname.match(/^\/api\/inquiries\/([^/]+)$/)
  if (inquiryDetailMatch && req.method === 'GET') {
    assertAcquisitionAccess(actor)
    const inquiry = await inquiryById(db, inquiryDetailMatch[1]); assertInquiryScope(actor, inquiry)
    const [items, messages] = await db.$transaction([
      db.inquiryItem.findMany({ where: { inquiryId: inquiry.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.channelMessage.findMany({ where: { inquiryId: inquiry.id }, orderBy: { occurredAt: 'desc' }, take: 50 }),
    ])
    return send(res, 200, { data: { ...inquiry, items, messages } })
  }

  return false
}
