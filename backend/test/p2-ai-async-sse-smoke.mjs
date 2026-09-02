import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.NEXFAB_AI_QUEUE_MEMORY_FALLBACK = 'true'
process.env.SESSION_SECRET = 'p2-ai-async-sse-smoke-session-secret-0123456789abcdef'
delete process.env.REDIS_URL
delete process.env.AI_QUEUE_REDIS_URL
delete process.env.AI_ENABLED
delete process.env.AI_PROVIDER
delete process.env.AI_DEFAULT_MODEL

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const { aiQueueStatus } = await import('../src/ai-queue.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

async function readSseUntilTerminal(path, cookie) {
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

try {

  const productionNoRedis = aiQueueStatus({ NODE_ENV: 'production' })
  assert.equal(productionNoRedis.enabled, false)
  assert.equal(productionNoRedis.backend, 'disabled')
  assert.equal(productionNoRedis.productionReady, false)

  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')

  const gatewayStatus = await request('/api/ai-gateway/status', { cookie: sales })
  assert.equal(gatewayStatus.response.status, 200)
  assert.equal(gatewayStatus.payload.data.queue.backend, 'memory')
  assert.equal(gatewayStatus.payload.data.queue.productionReady, false)

  const queueStatus = await request('/api/ai-queue/status', { cookie: sales })
  assert.equal(queueStatus.response.status, 200)
  assert.equal(queueStatus.payload.data.backend, 'memory')
  assert.equal(queueStatus.payload.data.productionReady, false)

  const asyncRun = await request('/api/ai-gateway/run', {
    cookie: sales,
    method: 'POST',
    body: {
      async: true,
      module: 'quote',
      purpose: 'P2.2 异步报价解释草稿',
      level: 'L1',
      input: {
        quoteNo: 'Q-P22-001',
        buyerEmail: 'secret-buyer@example.com',
        phone: '+1 555 000 1234',
        token: 'secret-token-value',
        OPENAI_API_KEY: 'mock-key-should-not-stream',
      },
    },
  })
  assert.equal(asyncRun.response.status, 202)
  assert.equal(asyncRun.payload.data.task.status, 'QUEUED')
  assert.equal(asyncRun.payload.data.queue.backend, 'memory')
  assert.equal(asyncRun.payload.data.queue.productionReady, false)
  assert.equal(asyncRun.payload.data.requiresHumanConfirmation, true)
  const taskId = asyncRun.payload.data.task.id

  const sseText = await readSseUntilTerminal(`/api/ai-tasks/${taskId}/events`, sales)
  assert.ok(sseText.includes('QUEUED'))
  assert.ok(sseText.includes('RUNNING') || sseText.includes('SUCCEEDED'))
  assert.ok(sseText.includes('SUCCEEDED'))
  assert.ok(!sseText.includes('secret-buyer@example.com'))
  assert.ok(!sseText.includes('secret-token-value'))
  assert.ok(!sseText.includes('mock-key-should-not-stream'))

  const task = await request(`/api/ai-tasks/${taskId}`, { cookie: sales })
  assert.equal(task.response.status, 200)
  assert.equal(task.payload.data.status, 'SUCCEEDED')
  assert.equal(task.payload.data.dataSentToCloud, false)
  assert.equal(typeof task.payload.data.tokens, 'number')
  assert.ok(task.payload.data.durationMs >= 0)
  assert.equal(String(task.payload.data.cost), '0')
  assert.ok(!JSON.stringify(task.payload.data.inputSummary).includes('secret-buyer@example.com'))
  assert.ok(!JSON.stringify(task.payload.data.inputSummary).includes('secret-token-value'))

  const noHumanToolCall = await request('/api/tool-calls', { cookie: sales, method: 'POST', body: { aiTaskId: taskId, module: 'QUOTE', toolName: 'EMAIL', action: 'SEND_QUOTE', requiresHumanConfirmation: false, inputSummary: { to: 'secret-buyer@example.com' } } })
  assert.equal(noHumanToolCall.response.status, 400)
  assert.equal(noHumanToolCall.payload.error.code, 'HUMAN_CONFIRMATION_REQUIRED')

  const cloudAsyncFail = await request('/api/ai-gateway/run', { cookie: finance, method: 'POST', body: { async: true, module: 'finance', purpose: '云端失败降级', provider: 'OPENAI', input: { token: 'secret-token-value' } } })
  assert.equal(cloudAsyncFail.response.status, 502)
  assert.equal(cloudAsyncFail.payload.error.detail.dataSentToCloud, false)
  assert.ok(cloudAsyncFail.payload.error.detail.aiTaskId)

  const adminRun = await request('/api/ai-gateway/run', { cookie: admin, method: 'POST', body: { async: true, module: 'quote', purpose: '管理员私有异步任务', input: { note: 'private admin task' } } })
  assert.equal(adminRun.response.status, 202)
  const salesOverreach = await request(`/api/ai-tasks/${adminRun.payload.data.task.id}/events`, { cookie: sales })
  assert.equal(salesOverreach.response.status, 403)



  process.env.NEXFAB_AI_QUEUE_MEMORY_FALLBACK = 'false'
  const noRedisNoFallback = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { async: true, module: 'quote', purpose: '生产无 Redis 禁止 fallback', input: { note: 'must 503' } } })
  assert.equal(noRedisNoFallback.response.status, 503)
  assert.equal(noRedisNoFallback.payload.error.code, 'AI_QUEUE_NOT_CONFIGURED')
  assert.equal(noRedisNoFallback.payload.error.detail.backend, 'disabled')
  process.env.NEXFAB_AI_QUEUE_MEMORY_FALLBACK = 'true'

  const knowledge = await request('/api/knowledge-documents', { cookie: manager, method: 'POST', body: { title: 'P2.2 RAG 基准资料', type: 'FAQ', sourceName: 'P22-FAQ.md', version: 'v1', chunks: [{ heading: '耐温', content: 'P2.2 测试产品耐温为 205°C。' }] } })
  assert.equal(knowledge.response.status, 201)
  const approved = await request(`/api/knowledge-documents/${knowledge.payload.data.id}/review`, { cookie: admin, method: 'POST', body: { status: 'APPROVED', note: 'P2.2 smoke' } })
  assert.equal(approved.response.status, 200)
  const insufficient = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: '完全不存在的冷门参数 xyz-no-match', module: 'product' } })
  assert.equal(insufficient.response.status, 200)
  assert.equal(insufficient.payload.data.status, 'INSUFFICIENT_CONTEXT')
  assert.equal(insufficient.payload.data.sources.length, 0)

  const state = testMemoryState()
  assert.ok(state.aiTasks.length >= 4)
  assert.ok(state.auditLogs.filter((item) => item.resource === 'ai_task').length >= 4)

  console.log(JSON.stringify({ result: 'passed', mode: 'ai-async-sse-memory-fallback', queueBackend: queueStatus.payload.data.backend, productionBackendWhenNoRedis: productionNoRedis.backend, productionReady: queueStatus.payload.data.productionReady, terminal: task.payload.data.status, dataSentToCloud: task.payload.data.dataSentToCloud, ragNoEvidence: insufficient.payload.data.status, noRedisNoFallback: noRedisNoFallback.response.status, toolMissingHuman: noHumanToolCall.response.status, overreachEvents: salesOverreach.response.status, auditLogs: state.auditLogs.filter((item) => item.resource === 'ai_task').length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
