import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-dashboard-smoke-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { response, payload: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

function metric(data, id) {
  return data.metrics.find((item) => item.id === id)
}

try {
  const sales = await login('sales@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const admin = await login('admin@nexfab.test')

  const invalidRange = await request('/api/dashboard?range=forever', { cookie: sales })
  assert.equal(invalidRange.response.status, 400)

  const emptyDashboard = await request('/api/dashboard?range=today', { cookie: sales })
  assert.equal(emptyDashboard.response.status, 200)
  assert.equal(emptyDashboard.payload.data.role, 'SALES')
  assert.equal(emptyDashboard.payload.data.aiMode, 'LOCAL_SUMMARY_ONLY')
  assert.equal(emptyDashboard.payload.data.noExternalSideEffects, true)
  assert.equal(metric(emptyDashboard.payload.data, 'openTodos').value, 0)

  const todo = await request('/api/todos', { cookie: sales, method: 'POST', body: { title: '跟进 24h 询盘', dueAt: '2026-08-24T09:00:00.000Z' } })
  assert.equal(todo.response.status, 201)
  assert.equal(todo.payload.data.userId, 'sales-1')
  const todoId = todo.payload.data.id

  const memo = await request('/api/memos', { cookie: sales, method: 'POST', body: { content: '客户偏好 DDP 报价，先人工复核运费。' } })
  assert.equal(memo.response.status, 201)
  assert.equal(memo.payload.data.userId, 'sales-1')
  const memoId = memo.payload.data.id

  const notification = await request('/api/notifications', { cookie: manager, method: 'POST', body: { recipientId: 'sales-1', type: 'dashboard', title: '报价待审批提醒', body: '请查看审批中心。', metadata: { token: 'secret-token' } } })
  assert.equal(notification.response.status, 201)

  const dashboard = await request('/api/dashboard?range=7d', { cookie: sales })
  assert.equal(dashboard.response.status, 200)
  assert.equal(dashboard.payload.data.range, '7d')
  assert.equal(metric(dashboard.payload.data, 'openTodos').value, 1)
  assert.equal(metric(dashboard.payload.data, 'recentMemos').value, 1)
  assert.equal(metric(dashboard.payload.data, 'unreadNotifications').value, 1)
  assert.equal(dashboard.payload.data.queues.todoItems.length, 1)
  assert.equal(dashboard.payload.data.queues.notificationItems.length, 1)
  assert.equal(dashboard.payload.data.queues.notificationItems[0].bodyPreview, '请查看审批中心。')
  assert.equal(dashboard.payload.data.queues.notificationItems[0].metadata, undefined)

  const openTodos = await request('/api/todos?pageSize=5', { cookie: sales })
  assert.equal(openTodos.response.status, 200)
  assert.equal(openTodos.payload.data.total, 1)

  const adminTodos = await request('/api/todos?pageSize=5', { cookie: admin })
  assert.equal(adminTodos.response.status, 200)
  assert.equal(adminTodos.payload.data.total, 0)

  const adminTodoDenied = await request(`/api/todos/${todoId}`, { cookie: admin })
  assert.equal(adminTodoDenied.response.status, 403)

  const doneTodo = await request(`/api/todos/${todoId}`, { cookie: sales, method: 'PATCH', body: { done: true } })
  assert.equal(doneTodo.response.status, 200)
  assert.ok(doneTodo.payload.data.doneAt)

  const doneTodos = await request('/api/todos?status=done', { cookie: sales })
  assert.equal(doneTodos.response.status, 200)
  assert.equal(doneTodos.payload.data.total, 1)
  const noOpenTodos = await request('/api/todos', { cookie: sales })
  assert.equal(noOpenTodos.payload.data.total, 0)

  const memos = await request('/api/memos', { cookie: sales })
  assert.equal(memos.response.status, 200)
  assert.equal(memos.payload.data.total, 1)

  const adminMemoDenied = await request(`/api/memos/${memoId}`, { cookie: admin })
  assert.equal(adminMemoDenied.response.status, 403)

  const updatedMemo = await request(`/api/memos/${memoId}`, { cookie: sales, method: 'PATCH', body: { content: '已改为 CIF 方案，仍需人工复核运费。' } })
  assert.equal(updatedMemo.response.status, 200)
  assert.equal(updatedMemo.payload.data.content.includes('CIF'), true)

  const state = testMemoryState()
  assert.equal(state.todos.length, 1)
  assert.equal(state.memos.length, 1)
  assert.equal(state.notifications.length, 1)
  assert.equal(state.auditLogs.filter((item) => ['todo', 'memo'].includes(item.resource)).length, 4)

  console.log(JSON.stringify({ result: 'passed', todos: state.todos.length, memos: state.memos.length, unreadNotifications: state.notifications.filter((item) => item.status === 'UNREAD').length, dashboardMode: dashboard.payload.data.aiMode }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
