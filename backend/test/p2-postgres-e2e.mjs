import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { once } from 'node:events'

if (process.env.NEXFAB_REAL_DB_E2E !== 'true') throw new Error('NEXFAB_REAL_DB_E2E=true is required; this test only targets a dedicated local test database.')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the PostgreSQL E2E test.')

const target = new URL(process.env.DATABASE_URL)
const database = target.pathname.replace(/^\//, '')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !database.startsWith('nexfab_p2_verify')) {
  throw new Error('Refusing PostgreSQL E2E outside the dedicated local nexfab_p2_verify database.')
}

process.env.NODE_ENV = 'test'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.NEXFAB_AI_QUEUE_MEMORY_FALLBACK = 'true'
process.env.SESSION_SECRET = 'p2-postgres-e2e-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { prisma } = await import('../src/prisma.mjs')
const { closeAiQueue } = await import('../src/ai-queue.mjs')
const db = await prisma()
const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`

function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

async function request(base, path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(base, email) {
  const result = await request(base, '/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.cookie)
  return result.cookie
}

async function readSseUntilTerminal(base, path, cookie) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie }, signal: controller.signal })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type')?.startsWith('text/event-stream'), true)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      if (text.includes('"terminal":true')) break
    }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
  return text
}

const team = await db.team.create({ data: { name: `P2 E2E ${suffix}` } })
const manager = await db.user.create({ data: { email: `manager-${suffix}@nexfab.test`, name: 'P2 测试经理', passwordHash: passwordHash('TestOnly#Password1'), role: 'MANAGER', teamId: team.id } })
await db.team.update({ where: { id: team.id }, data: { managerId: manager.id } })
const sales = await db.user.create({ data: { email: `sales-${suffix}@nexfab.test`, name: 'P2 测试销售', passwordHash: passwordHash('TestOnly#Password1'), role: 'SALES', teamId: team.id } })
// 修复说明：[中危-口径同步] 知识文档审核禁止自审，补建独立 ADMIN 审核人。
const admin = await db.user.create({ data: { email: `admin-${suffix}@nexfab.test`, name: 'P2 测试管理员', passwordHash: passwordHash('TestOnly#Password1'), role: 'ADMIN', teamId: null } })

const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

try {
  const managerCookie = await login(base, manager.email)
  const adminCookie = await login(base, admin.email)
  const salesCookie = await login(base, sales.email)
  const ready = await fetch(`${base}/ready`)
  assert.equal(ready.status, 200)
  const queue = await request(base, '/api/ai-queue/status', { cookie: salesCookie })
  assert.equal(queue.response.status, 200)
  const expectedQueueBackend = process.env.REDIS_URL || process.env.AI_QUEUE_REDIS_URL ? 'bullmq-redis' : 'memory'
  assert.equal(queue.payload.data.backend, expectedQueueBackend)

  const document = await request(base, '/api/knowledge-documents', {
    cookie: managerCookie,
    method: 'POST',
    body: { title: `P2 PostgreSQL 来源 ${suffix}`, type: 'FAQ', sourceName: 'p2-postgres-e2e.md', version: 'v1', chunks: [{ heading: '已审核条款', content: '真实 PostgreSQL E2E 资料：对外承诺前必须人工确认。' }] },
  })
  assert.equal(document.response.status, 201)
  // 修复说明：[中危-口径同步] 知识文档审核禁止自审；E2E 改由 ADMIN 审核。
  const reviewed = await request(base, `/api/knowledge-documents/${document.payload.data.id}/review`, { cookie: adminCookie, method: 'POST', body: { status: 'APPROVED', note: 'P2 real DB E2E' } })
  assert.equal(reviewed.response.status, 200)
  const rag = await request(base, '/api/rag/query', { cookie: salesCookie, method: 'POST', body: { query: '真实 PostgreSQL E2E 对外承诺', module: 'AI_AGENT' } })
  assert.equal(rag.response.status, 200)
  assert.equal(rag.payload.data.status, 'ANSWERED_WITH_SOURCES')
  assert.equal(rag.payload.data.sources[0].fileName, 'p2-postgres-e2e.md')

  const asyncRun = await request(base, '/api/ai-gateway/run', { cookie: salesCookie, method: 'POST', body: { async: true, module: 'AI_AGENT', purpose: '真实 PostgreSQL 异步草稿', input: { request: '仅生成本地草稿；不得执行外部操作。' } } })
  assert.equal(asyncRun.response.status, 202)
  assert.equal(asyncRun.payload.data.queue.backend, expectedQueueBackend)
  const stream = await readSseUntilTerminal(base, asyncRun.payload.data.eventsUrl, salesCookie)
  assert.ok(stream.includes('QUEUED'))
  assert.ok(stream.includes('SUCCEEDED'))
  assert.ok(!stream.includes('不得执行外部操作'))

  const task = await request(base, `/api/ai-tasks/${asyncRun.payload.data.task.id}`, { cookie: salesCookie })
  assert.equal(task.response.status, 200)
  assert.equal(task.payload.data.status, 'SUCCEEDED')
  assert.equal(task.payload.data.dataSentToCloud, false)
  console.log(JSON.stringify({ result: 'passed', mode: 'p2-postgresql-pgvector-e2e', database: 'dedicated-local', ready: ready.status, queueBackend: expectedQueueBackend, rag: rag.payload.data.status, citations: rag.payload.data.sources.length, asyncTerminal: task.payload.data.status, dataSentToCloud: false }))
} finally {
  await new Promise((resolve) => server.close(resolve))
  await closeAiQueue()
  await db.$disconnect()
}
