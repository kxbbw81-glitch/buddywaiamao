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

async function count(model, where) {
  return model.count({ where })
}

async function getDashboardData(db, actor, range) {
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
