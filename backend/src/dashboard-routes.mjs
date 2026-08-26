import { orderScopeFor, scopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const DASHBOARD_ROLES = new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN'])

function assertDashboardAccess(actor) {
  if (!DASHBOARD_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问工作台。')
}

function parseDate(value, field, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不是有效日期。`)
  return date
}

function todoInput(body) {
  return {
    title: text(body.title, '待办标题', { required: true, max: 180 }),
    dueAt: parseDate(body.dueAt, '截止时间'),
  }
}

function memoInput(body) {
  return {
    content: text(body.content, '备忘内容', { required: true, max: 4000 }),
  }
}

async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function ownedTodo(db, actor, id) {
  const todo = await db.todo.findUnique({ where: { id } })
  if (!todo) throw new HttpError(404, 'NOT_FOUND', '待办不存在。')
  if (todo.userId !== actor.id) throw new HttpError(403, 'FORBIDDEN', '只能访问自己的待办。')
  return todo
}

async function ownedMemo(db, actor, id) {
  const memo = await db.memo.findUnique({ where: { id } })
  if (!memo) throw new HttpError(404, 'NOT_FOUND', '备忘不存在。')
  if (memo.userId !== actor.id) throw new HttpError(403, 'FORBIDDEN', '只能访问自己的备忘。')
  return memo
}

function quoteApprovalWhere(actor) {
  if (actor.role === 'SALES') return { requestedById: actor.id, status: 'PENDING' }
  if (actor.role === 'MANAGER' || actor.role === 'FINANCE' || actor.role === 'ADMIN') return { status: 'PENDING' }
  return { status: '__NO_ACCESS__' }
}

function toolCallWhere(actor) {
  if (actor.role === 'SALES') return { createdById: actor.id, status: 'PENDING_CONFIRMATION' }
  if (actor.role === 'MANAGER' || actor.role === 'ADMIN') return { status: 'PENDING_CONFIRMATION' }
  return { status: '__NO_ACCESS__' }
}

function sampleWhere(actor) {
  if (actor.role === 'SALES') return { ownerId: actor.id }
  if (actor.role === 'MANAGER' || actor.role === 'EXEC' || actor.role === 'ADMIN') return {}
  return { ownerId: '__NO_ACCESS__' }
}

function orderPaymentWhere(actor) {
  if (actor.role === 'FINANCE' || actor.role === 'ADMIN') return { status: 'REGISTERED' }
  return { status: '__NO_ACCESS__' }
}

function crmReadableScope(actor) {
  if (actor.role === 'FINANCE') return { ownerId: '__NO_ACCESS__' }
  return scopeFor(actor)
}

function leadReadableScope(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC') return {}
  if (actor.role === 'SALES') return { ownerId: actor.id }
  if (actor.role === 'MANAGER') return { OR: [{ ownerId: actor.id }, { ownerId: null }, { owner: { teamId: actor.teamId } }] }
  return { ownerId: '__NO_ACCESS__' }
}

function quoteReadableWhere(actor) {
  const customerScope = crmReadableScope(actor)
  return Object.keys(customerScope).length ? { customer: customerScope } : {}
}

function orderReadableWhere(actor) {
  const customerScope = orderScopeFor(actor)
  return Object.keys(customerScope).length ? { customer: customerScope } : {}
}

// 保留 PrismaPromise，才能作为 $transaction([...]) 的批量操作在真实 PostgreSQL 执行。
function count(model, where) {
  return model.count({ where })
}

export async function getDashboardData(db, actor, range) {
  const [
    openTodos,
    unreadNotifications,
    pendingQuoteApprovals,
    pendingToolCalls,
    sampleRequests,
    pendingPayments,
    recentAutomationRuns,
    failedWebhooks,
    recentMemos,
  ] = await db.$transaction([
    count(db.todo, { userId: actor.id, doneAt: null }),
    count(db.notification, { recipientId: actor.id, status: 'UNREAD' }),
    count(db.quoteApproval, quoteApprovalWhere(actor)),
    count(db.toolCall, toolCallWhere(actor)),
    count(db.sampleRequest, sampleWhere(actor)),
    count(db.orderPayment, orderPaymentWhere(actor)),
    count(db.automationRun, {}),
    count(db.webhookEvent, { status: 'FAILED' }),
    count(db.memo, { userId: actor.id }),
  ])

  const [
    leadsTotal,
    leadsNew,
    inquiriesTotal,
    customersTotal,
    opportunitiesTotal,
    quotesTotal,
    quotesSent,
    ordersTotal,
    ordersDelivered,
    confirmedPayments,
    registeredPayments,
    generatedDocuments,
    activeShipments,
  ] = await db.$transaction([
    count(db.lead, leadReadableScope(actor)),
    count(db.lead, { AND: [leadReadableScope(actor), { status: 'NEW' }] }),
    count(db.inquiry, leadReadableScope(actor)),
    count(db.customer, crmReadableScope(actor)),
    count(db.opportunity, crmReadableScope(actor)),
    count(db.quote, quoteReadableWhere(actor)),
    count(db.quote, { AND: [quoteReadableWhere(actor), { status: 'SENT' }] }),
    count(db.salesOrder, orderReadableWhere(actor)),
    count(db.salesOrder, { AND: [orderReadableWhere(actor), { fulfillmentStatus: 'DELIVERED' }] }),
    count(db.orderPayment, { AND: [{ status: 'CONFIRMED' }, ...(Object.keys(orderReadableWhere(actor)).length ? [{ salesOrder: orderReadableWhere(actor) }] : [])] }),
    count(db.orderPayment, { AND: [{ status: 'REGISTERED' }, ...(Object.keys(orderReadableWhere(actor)).length ? [{ salesOrder: orderReadableWhere(actor) }] : [])] }),
    count(db.tradeDocument, Object.keys(orderReadableWhere(actor)).length ? { salesOrder: orderReadableWhere(actor) } : {}),
    count(db.shipment, { AND: [Object.keys(orderReadableWhere(actor)).length ? { salesOrder: orderReadableWhere(actor) } : {}, { status: 'SHIPPED' }] }),
  ])

  const [todoItems, notificationItems] = await db.$transaction([
    db.todo.findMany({ where: { userId: actor.id, doneAt: null }, orderBy: { dueAt: 'asc' }, take: 5 }),
    db.notification.findMany({ where: { recipientId: actor.id, status: 'UNREAD' }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  const metrics = [
    { id: 'openTodos', label: '我的待办', value: openTodos, scope: 'personal' },
    { id: 'unreadNotifications', label: '未读通知', value: unreadNotifications, scope: 'personal' },
    { id: 'pendingQuoteApprovals', label: '待审批报价', value: pendingQuoteApprovals, scope: actor.role === 'SALES' ? 'requested-by-me' : 'role-queue' },
    { id: 'pendingToolCalls', label: '待确认工具动作', value: pendingToolCalls, scope: actor.role === 'SALES' ? 'created-by-me' : 'role-queue' },
    { id: 'sampleRequests', label: '样品事项', value: sampleRequests, scope: actor.role === 'SALES' ? 'owned-by-me' : 'role-visible' },
    { id: 'pendingPayments', label: '待确认回款', value: pendingPayments, scope: 'finance-queue' },
    { id: 'recentAutomationRuns', label: '自动化运行记录', value: recentAutomationRuns, scope: 'system-log' },
    { id: 'failedWebhooks', label: 'Webhook 失败记录', value: failedWebhooks, scope: 'integration-risk' },
    { id: 'recentMemos', label: '个人备忘', value: recentMemos, scope: 'personal' },
  ]

  const actionCards = [
    { id: 'todo', title: '待办清单', status: openTodos ? 'ACTION_REQUIRED' : 'CLEAR', count: openTodos, href: '/dashboard/todos' },
    { id: 'notifications', title: '未读通知', status: unreadNotifications ? 'ACTION_REQUIRED' : 'CLEAR', count: unreadNotifications, href: '/dashboard/notifications' },
    { id: 'approvals', title: '审批中心', status: pendingQuoteApprovals ? 'ACTION_REQUIRED' : 'CLEAR', count: pendingQuoteApprovals, href: '/quote/approvals' },
    { id: 'toolCalls', title: '外部动作确认', status: pendingToolCalls ? 'ACTION_REQUIRED' : 'CLEAR', count: pendingToolCalls, href: '/system/tool-calls' },
  ]

  const business = {
    mode: 'CURRENT_CUMULATIVE_OVERVIEW',
    rangeLabel: '当前累计概览',
    note: '当前后端按角色数据范围统计累计数据，today/7d/30d 暂不代表严格日期窗口。',
    funnel: [
      { id: 'leadsTotal', label: '线索总数', value: leadsTotal },
      { id: 'leadsNew', label: '新线索', value: leadsNew },
      { id: 'inquiriesTotal', label: '询盘', value: inquiriesTotal },
      { id: 'customersTotal', label: '客户', value: customersTotal },
      { id: 'opportunitiesTotal', label: '商机', value: opportunitiesTotal },
    ],
    revenue: [
      { id: 'quotesTotal', label: '报价数', value: quotesTotal },
      { id: 'quotesSent', label: '已发送报价', value: quotesSent },
      { id: 'ordersTotal', label: '订单数', value: ordersTotal },
      { id: 'ordersDelivered', label: '已签收订单', value: ordersDelivered },
      { id: 'confirmedPayments', label: '已确认回款', value: confirmedPayments },
    ],
    operations: [
      { id: 'registeredPayments', label: '待确认回款', value: registeredPayments },
      { id: 'generatedDocuments', label: '单证记录', value: generatedDocuments },
      { id: 'activeShipments', label: '运输中物流', value: activeShipments },
    ],
    risks: [
      { id: 'pendingQuoteApprovals', label: '待审批报价', value: pendingQuoteApprovals, severity: pendingQuoteApprovals ? 'amber' : 'green' },
      { id: 'registeredPayments', label: '待财务确认回款', value: registeredPayments, severity: registeredPayments ? 'red' : 'green' },
      { id: 'failedWebhooks', label: 'Webhook 失败', value: failedWebhooks, severity: failedWebhooks ? 'red' : 'green' },
    ],
  }

  return {
    role: actor.role,
    range,
    generatedAt: new Date().toISOString(),
    metrics,
    queues: {
      todoItems,
      notificationItems: notificationItems.map(({ body, metadata, ...item }) => ({ ...item, bodyPreview: body ? body.slice(0, 120) : null, metadataKeys: metadata && typeof metadata === 'object' ? Object.keys(metadata).slice(0, 20) : [] })),
    },
    actionCards,
    business,
    aiMode: 'LOCAL_SUMMARY_ONLY',
    noExternalSideEffects: true,
  }
}

export async function handleDashboardRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/dashboard') {
    assertDashboardAccess(actor)
    const range = url.searchParams.get('range') || 'today'
    if (!['today', '7d', '30d'].includes(range)) throw new HttpError(400, 'VALIDATION_ERROR', 'range 仅支持 today / 7d / 30d。')
    return send(res, 200, { data: await getDashboardData(db, actor, range) })
  }

  if (req.method === 'GET' && pathname === '/api/todos') {
    assertDashboardAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status') || 'open'
    const where = { userId: actor.id, ...(status === 'all' ? {} : status === 'done' ? { doneAt: { not: null } } : { doneAt: null }) }
    const [items, total] = await db.$transaction([
      db.todo.findMany({ where, orderBy: { dueAt: 'asc' }, skip, take: pageSize }),
      db.todo.count({ where }),
    ])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/todos') {
    assertDashboardAccess(actor)
    const data = todoInput(await readJson(req))
    const row = await db.todo.create({ data: { ...data, userId: actor.id } })
    await audit(db, actor, 'CREATE', 'todo', row.id, { personal: true })
    return send(res, 201, { data: row })
  }

  const todoMatch = pathname.match(/^\/api\/todos\/([^/]+)$/)
  if (todoMatch && req.method === 'GET') {
    assertDashboardAccess(actor)
    return send(res, 200, { data: await ownedTodo(db, actor, todoMatch[1]) })
  }

  if (todoMatch && req.method === 'PATCH') {
    assertDashboardAccess(actor)
    const current = await ownedTodo(db, actor, todoMatch[1])
    const body = await readJson(req)
    const data = {}
    if (body.title != null) data.title = text(body.title, '待办标题', { required: true, max: 180 })
    if (Object.prototype.hasOwnProperty.call(body, 'dueAt')) data.dueAt = parseDate(body.dueAt, '截止时间')
    if (Object.prototype.hasOwnProperty.call(body, 'done')) data.doneAt = body.done ? new Date() : null
    if (!Object.keys(data).length) throw new HttpError(400, 'VALIDATION_ERROR', '没有可更新字段。')
    const row = await db.todo.update({ where: { id: current.id }, data })
    await audit(db, actor, 'UPDATE', 'todo', row.id, { fields: Object.keys(data), personal: true })
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/memos') {
    assertDashboardAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const where = { userId: actor.id }
    const [items, total] = await db.$transaction([
      db.memo.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }),
      db.memo.count({ where }),
    ])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/memos') {
    assertDashboardAccess(actor)
    const data = memoInput(await readJson(req))
    const row = await db.memo.create({ data: { ...data, userId: actor.id } })
    await audit(db, actor, 'CREATE', 'memo', row.id, { personal: true })
    return send(res, 201, { data: row })
  }

  const memoMatch = pathname.match(/^\/api\/memos\/([^/]+)$/)
  if (memoMatch && req.method === 'GET') {
    assertDashboardAccess(actor)
    return send(res, 200, { data: await ownedMemo(db, actor, memoMatch[1]) })
  }

  if (memoMatch && req.method === 'PATCH') {
    assertDashboardAccess(actor)
    const current = await ownedMemo(db, actor, memoMatch[1])
    const data = memoInput(await readJson(req))
    const row = await db.memo.update({ where: { id: current.id }, data })
    await audit(db, actor, 'UPDATE', 'memo', row.id, { personal: true })
    return send(res, 200, { data: row })
  }

  return false
}
