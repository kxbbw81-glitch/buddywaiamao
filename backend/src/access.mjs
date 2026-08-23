import { HttpError } from './http.mjs'

const READ_ROLES = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
const WRITE_ROLES = new Set(['SALES', 'MANAGER', 'ADMIN'])

export function assertCrmAccess(actor, write = false) {
  const allowed = write ? WRITE_ROLES : READ_ROLES
  if (!allowed.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问该业务域。')
}

export function scopeFor(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return {}
  if (actor.role === 'SALES') return { ownerId: actor.id }
  if (actor.role === 'MANAGER') {
    if (!actor.teamId) return { ownerId: actor.id }
    return { OR: [{ ownerId: actor.id }, { owner: { teamId: actor.teamId } }] }
  }
  throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问该业务域。')
}

export function assertCustomerScope(actor, customer) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return
  if (customer.ownerId === actor.id) return
  if (actor.role === 'MANAGER' && actor.teamId && customer.owner?.teamId === actor.teamId) return
  throw new HttpError(403, 'FORBIDDEN', '无权访问该客户数据。')
}

export function assertProductAccess(actor, write = false) {
  const readable = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
  const writable = new Set(['MANAGER', 'ADMIN'])
  if (!(write ? writable : readable).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或修改产品 PIM。')
}

export function assertQuoteAccess(actor, write = false) {
  const readable = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
  const writable = new Set(['SALES', 'MANAGER', 'ADMIN'])
  if (!(write ? writable : readable).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或修改报价中心。')
}

export function assertOrderAccess(actor, write = false) {
  const readable = new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN'])
  const writable = new Set(['SALES', 'MANAGER', 'ADMIN'])
  if (!(write ? writable : readable).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或修改订单履约。')
}

export function orderScopeFor(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC' || actor.role === 'FINANCE') return {}
  return scopeFor(actor)
}

export function assertPaymentAccess(actor, action = 'read') {
  if (action === 'confirm') {
    if (!new Set(['FINANCE', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权确认回款。')
    return
  }
  if (action === 'write') {
    if (!new Set(['SALES', 'MANAGER', 'FINANCE', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权登记回款。')
    return
  }
  if (!new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问回款。')
}

export function assertTimelineAccess(actor, write = false) {
  const readable = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
  const writable = new Set(['SALES', 'MANAGER', 'ADMIN'])
  if (!(write ? writable : readable).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或修改沟通时间线。')
}

export function assertRagAccess(actor) {
  if (!new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问 AI/RAG。')
}

export function assertSampleAccess(actor, write = false) {
  const readable = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
  const writable = new Set(['SALES', 'MANAGER', 'ADMIN'])
  if (!(write ? writable : readable).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或修改样品管理。')
}

export function assertTradeDocumentAccess(actor, action = 'read') {
  if (action === 'review') {
    if (!new Set(['MANAGER', 'FINANCE', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权审核外贸单证。')
    return
  }
  if (action === 'write') {
    if (!new Set(['SALES', 'MANAGER', 'FINANCE', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权生成外贸单证。')
    return
  }
  if (!new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问外贸单证。')
}

export function assertFulfillmentAccess(actor, write = false) {
  const readable = new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN'])
  const writable = new Set(['SALES', 'MANAGER', 'ADMIN'])
  if (!(write ? writable : readable).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或更新生产物流。')
}

export function assertCommissionAccess(actor, action = 'read') {
  if (action === 'approve' || action === 'settle') {
    if (!new Set(['FINANCE', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权结算或审批提成。')
    return
  }
  if (!new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问提成与对账。')
}

export function assertKnowledgeAccess(actor, action = 'read') {
  if (action === 'review' || action === 'write') {
    if (!new Set(['MANAGER', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权维护或审核知识库。')
    return
  }
  if (!new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问知识库。')
}

export function assertAiGatewayAccess(actor, action = 'run') {
  if (action === 'prompt-write') {
    if (!new Set(['MANAGER', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权维护 Prompt 模板。')
    return
  }
  if (!new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问 AI Gateway。')
}

export function aiTaskScopeFor(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC' || actor.role === 'FINANCE') return {}
  if (actor.role === 'MANAGER' && actor.teamId) return { OR: [{ createdById: actor.id }, { createdBy: { teamId: actor.teamId } }] }
  return { createdById: actor.id }
}

export function assertAiTaskScope(actor, task) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC' || actor.role === 'FINANCE') return
  if (task.createdById === actor.id) return
  if (actor.role === 'MANAGER' && actor.teamId && task.createdBy?.teamId === actor.teamId) return
  throw new HttpError(403, 'FORBIDDEN', '无权访问该 AI 调用记录。')
}
