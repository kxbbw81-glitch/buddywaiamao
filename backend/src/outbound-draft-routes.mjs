import { assertCustomerScope, assertTimelineAccess, scopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const READ_ROLES = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
const APPROVE_ROLES = new Set(['MANAGER', 'ADMIN'])
const CHANNELS = new Set(['EMAIL', 'WHATSAPP', 'B2B_MESSAGE'])
const STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT_RECORDED', 'ARCHIVED'])
const include = { customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } }, opportunity: { select: { id: true, name: true, stage: true } }, createdBy: { select: { id: true, name: true, role: true } } }

function role(actor, allowed, message = '当前角色无权访问渠道草稿。') { if (!allowed.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', message) }
function parseDraft(row) { try { const data = JSON.parse(row.content || '{}'); return data?.mode === 'OUTBOUND_DRAFT' ? data : null } catch { return null } }
function present(row) { const draft = parseDraft(row); return draft ? { id: row.id, customerId: row.customerId, opportunityId: row.opportunityId, createdBy: row.createdBy, createdAt: row.createdAt, updatedAt: row.updatedAt, ...draft } : null }
function draftInput(body) {
  const channel = text(body.channel || 'EMAIL', '渠道', { required: true, max: 20 })?.toUpperCase()
  if (!CHANNELS.has(channel)) throw new HttpError(400, 'VALIDATION_ERROR', '草稿渠道仅支持 EMAIL / WHATSAPP / B2B_MESSAGE。')
  return { customerId: text(body.customerId, '客户', { required: true, max: 120 }), opportunityId: text(body.opportunityId, '商机', { max: 120 }), channel, recipient: text(body.recipient, '收件方', { required: true, max: 320 }), subject: text(body.subject, '主题', { required: true, max: 240 }), body: text(body.body, '草稿正文', { required: true, max: 12000 }), campaignCode: text(body.campaignCode, '活动编码', { max: 80 }) }
}
async function audit(db, actor, action, id, detail) { await db.auditLog.create({ data: { userId: actor.id, action, resource: 'outbound_draft', resourceId: id, detail } }) }
async function customer(db, id) { const row = await db.customer.findUnique({ where: { id }, include: { owner: { select: { id: true, teamId: true } } } }); if (!row) throw new HttpError(404, 'NOT_FOUND', '客户不存在。'); return row }
async function draftById(db, actor, id) { const row = await db.communicationEvent.findUnique({ where: { id }, include }); if (!row || !parseDraft(row)) throw new HttpError(404, 'NOT_FOUND', '渠道草稿不存在。'); assertCustomerScope(actor, row.customer); return row }

export async function handleOutboundDraftRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/outbound-drafts') {
    role(actor, READ_ROLES); assertTimelineAccess(actor)
    const { page, pageSize, skip } = listQuery(url); const status = url.searchParams.get('status')?.toUpperCase()
    if (status && !STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '草稿状态不支持。')
    const where = { type: 'EMAIL', direction: 'OUTBOUND', ...(Object.keys(scopeFor(actor)).length ? { customer: scopeFor(actor) } : {}) }
    const rows = await db.communicationEvent.findMany({ where, include, orderBy: { updatedAt: 'desc' }, skip: 0, take: 200 })
    const items = rows.map(present).filter(Boolean).filter((item) => !status || item.status === status)
    return send(res, 200, { data: { items: items.slice(skip, skip + pageSize), page, pageSize, total: items.length } })
  }
  if (req.method === 'POST' && pathname === '/api/outbound-drafts') {
    role(actor, READ_ROLES); assertTimelineAccess(actor, true)
    const input = draftInput(await readJson(req)); const target = await customer(db, input.customerId); assertCustomerScope(actor, target)
    if (input.opportunityId) { const opp = await db.opportunity.findUnique({ where: { id: input.opportunityId } }); if (!opp || opp.customerId !== target.id) throw new HttpError(400, 'VALIDATION_ERROR', '商机不属于所选客户。') }
    const payload = { mode: 'OUTBOUND_DRAFT', status: 'DRAFT', ...input, createdById: actor.id, requiresHumanConfirmation: true, externalCall: false }
    const row = await db.communicationEvent.create({ data: { customerId: input.customerId, opportunityId: input.opportunityId, type: 'EMAIL', direction: 'OUTBOUND', summary: `渠道草稿：${input.subject}`, content: JSON.stringify(payload), ownerId: target.ownerId, createdById: actor.id }, include })
    await audit(db, actor, 'CREATE', row.id, { channel: input.channel, status: 'DRAFT', externalCall: false }); return send(res, 201, { data: present(row) })
  }
  const action = pathname.match(/^\/api\/outbound-drafts\/([^/]+)\/(submit-review|approve|record-manual-send)$/)
  if (action && req.method === 'POST') {
    role(actor, READ_ROLES); const row = await draftById(db, actor, action[1]); const draft = parseDraft(row)
    let nextStatus; if (action[2] === 'submit-review') { if (row.createdById !== actor.id && !APPROVE_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '只能提交自己的草稿。'); if (!['DRAFT', 'ARCHIVED'].includes(draft.status)) throw new HttpError(409, 'INVALID_STATE', '当前草稿不能提交审核。'); nextStatus = 'IN_REVIEW' }
    if (action[2] === 'approve') { role(actor, APPROVE_ROLES, '只有主管或管理员可审核草稿。'); if (draft.status !== 'IN_REVIEW') throw new HttpError(409, 'INVALID_STATE', '只有待审核草稿可以通过。'); nextStatus = 'APPROVED' }
    if (action[2] === 'record-manual-send') { role(actor, APPROVE_ROLES, '只有主管或管理员可登记人工发送。'); if (draft.status !== 'APPROVED') throw new HttpError(409, 'INVALID_STATE', '必须先审核通过，才可登记人工发送。'); nextStatus = 'SENT_RECORDED' }
    const body = await readJson(req); const next = { ...draft, status: nextStatus, approvalNote: action[2] === 'approve' ? text(body.note, '审核意见', { max: 1000 }) : draft.approvalNote, approvedById: action[2] === 'approve' ? actor.id : draft.approvedById, sentAt: action[2] === 'record-manual-send' ? new Date().toISOString() : draft.sentAt, externalCall: false }
    const updated = await db.communicationEvent.update({ where: { id: row.id }, data: { content: JSON.stringify(next) }, include }); await audit(db, actor, action[2].toUpperCase(), row.id, { from: draft.status, to: nextStatus, externalCall: false }); return send(res, 200, { data: present(updated) })
  }
  return false
}
