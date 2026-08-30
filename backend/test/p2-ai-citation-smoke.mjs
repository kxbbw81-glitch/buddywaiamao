import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-ai-citation-smoke-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { response, payload: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

try {
  const manager = await login('manager@nexfab.test')
  const admin = await login('admin@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: 'AI 引用产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'CITE-001', name: '引用测试耗材', categoryId: category.payload.data.id, specs: { material: 'PLA' }, packing: { carton: 12 }, costVersions: { current: 9 } } })
  assert.equal(product.response.status, 201)

  const draft = await request('/api/knowledge-documents', {
    cookie: manager,
    method: 'POST',
    body: {
      title: 'CITE-001 产品资料',
      type: 'FAQ',
      sourceName: 'CITE-001-FAQ.md',
      version: 'v2',
      productId: product.payload.data.id,
      chunks: [
        { heading: 'Nozzle temperature', content: 'CITE-001 recommended nozzle temperature is 210°C and must be confirmed against the approved product sheet.' },
      ],
    },
  })
  assert.equal(draft.response.status, 201)
  const approved = await request(`/api/knowledge-documents/${draft.payload.data.id}/review`, { cookie: admin, method: 'POST', body: { status: 'APPROVED', note: '资料审核通过' } })
  assert.equal(approved.response.status, 200)

  const answered = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'CITE-001 nozzle temperature', productId: product.payload.data.id, module: 'product' } })
  assert.equal(answered.response.status, 200)
  assert.equal(answered.payload.data.status, 'ANSWERED_WITH_SOURCES')
  assert.equal(answered.payload.data.sources.length, 1)
  assert.ok(answered.payload.data.aiTaskId)

  const taskDetail = await request(`/api/ai-tasks/${answered.payload.data.aiTaskId}`, { cookie: exec })
  assert.equal(taskDetail.response.status, 200)
  assert.equal(taskDetail.payload.data._count.citations, 1)
  assert.equal(taskDetail.payload.data._count.feedbacks, 0)
  assert.equal(taskDetail.payload.data.dataSentToCloud, false)

  const citationList = await request(`/api/ai-tasks/${answered.payload.data.aiTaskId}/citations?pageSize=1`, { cookie: exec })
  assert.equal(citationList.response.status, 200)
  assert.equal(citationList.payload.data.total, 1)
  assert.equal(citationList.payload.data.items.length, 1)
  assert.equal(citationList.payload.data.items[0].sourceName, 'CITE-001-FAQ.md')
  assert.equal(citationList.payload.data.items[0].version, 'v2')
  assert.equal(citationList.payload.data.items[0].metadata, undefined)

  const citationDetail = await request(`/api/ai-citations/${citationList.payload.data.items[0].id}`, { cookie: exec })
  assert.equal(citationDetail.response.status, 200)
  assert.equal(citationDetail.payload.data.aiTask.id, answered.payload.data.aiTaskId)
  assert.equal(citationDetail.payload.data.knowledgeDocument.sourceName, 'CITE-001-FAQ.md')
  assert.equal(citationDetail.payload.data.knowledgeChunk.heading, 'Nozzle temperature')
  assert.equal(citationDetail.payload.data.metadata.sourcePolicy, 'APPROVED_AND_NOT_EXPIRED_ONLY')

  const noSource = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'missing private certification', module: 'product' } })
  assert.equal(noSource.response.status, 200)
  assert.equal(noSource.payload.data.status, 'INSUFFICIENT_CONTEXT')
  assert.ok(noSource.payload.data.aiTaskId)
  const noSourceCitations = await request(`/api/ai-tasks/${noSource.payload.data.aiTaskId}/citations`, { cookie: exec })
  assert.equal(noSourceCitations.response.status, 200)
  assert.equal(noSourceCitations.payload.data.total, 0)

  const state = testMemoryState()
  assert.equal(state.aiTasks.length, 2)
  assert.equal(state.aiCitations.length, 1)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'ai_task').length, 2)

  console.log(JSON.stringify({ result: 'passed', aiTasks: state.aiTasks.length, aiCitations: state.aiCitations.length, citationSource: citationList.payload.data.items[0].sourceName }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
