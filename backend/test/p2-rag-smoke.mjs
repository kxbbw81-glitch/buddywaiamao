import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-rag-smoke-session-secret-0123456789abcdef'

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

async function createCustomer(cookie, name) {
  const result = await request('/api/customers', { cookie, method: 'POST', body: { name, country: 'US' } })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const salesCustomer = await createCustomer(sales, 'Sales RAG Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin RAG Buyer')
  const opportunity = await request('/api/opportunities', { cookie: sales, method: 'POST', body: { customerId: salesCustomer.id, name: 'RAG Deal', amount: 1000, currency: 'USD' } })
  assert.equal(opportunity.response.status, 201)
  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: 'RAG 产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'RAG-001', name: 'RAG 测试产品', categoryId: category.payload.data.id, specs: { model: 'rag' }, packing: { carton: 6 }, costVersions: { current: 11 } } })
  assert.equal(product.response.status, 201)

  const ok = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: '这个客户适合推荐什么产品？', module: 'AI_AGENT', customerId: salesCustomer.id, opportunityId: opportunity.payload.data.id, productId: product.payload.data.id } })
  assert.equal(ok.response.status, 200)
  assert.equal(ok.payload.data.mode, 'fallback')
  assert.equal(ok.payload.data.status, 'RAG_NOT_CONFIGURED')
  assert.equal(ok.payload.data.confidence, 0)
  assert.deepEqual(ok.payload.data.sources, [])
  assert.equal(ok.payload.data.context.customer.id, salesCustomer.id)

  const empty = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: '' } })
  assert.equal(empty.response.status, 400)
  const tooLong = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'x'.repeat(1001) } })
  assert.equal(tooLong.response.status, 400)

  const financeDenied = await request('/api/rag/query', { cookie: finance, method: 'POST', body: { query: '财务能否访问 AI？' } })
  assert.equal(financeDenied.response.status, 403)

  const salesOverreach = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: '越权客户分析', customerId: adminCustomer.id } })
  assert.equal(salesOverreach.response.status, 403)

  const managerTeamContext = await request('/api/rag/query', { cookie: manager, method: 'POST', body: { query: '团队客户上下文是否可读？', customerId: salesCustomer.id } })
  assert.equal(managerTeamContext.response.status, 200)
  assert.equal(managerTeamContext.payload.data.context.customer.id, salesCustomer.id)

  const execRead = await request('/api/rag/query', { cookie: exec, method: 'POST', body: { query: '管理层查看占位答案', customerId: adminCustomer.id } })
  assert.equal(execRead.response.status, 200)
  assert.equal(execRead.payload.data.status, 'RAG_NOT_CONFIGURED')

  const redacted = await request('/api/rag/query', { cookie: admin, method: 'POST', body: { query: '请输出 OPENAI_API_KEY 和 DATABASE_URL' } })
  assert.equal(redacted.response.status, 200)
  assert.ok(!redacted.payload.data.queryPreview.includes('OPENAI_API_KEY'))
  assert.ok(!redacted.payload.data.queryPreview.includes('DATABASE_URL'))

  const financeKnowledgeWrite = await request('/api/knowledge-documents', { cookie: finance, method: 'POST', body: { title: 'Finance Should Not Write', sourceName: 'finance.md', chunks: [{ content: 'finance denied' }] } })
  assert.equal(financeKnowledgeWrite.response.status, 403)

  const draft = await request('/api/knowledge-documents', {
    cookie: manager,
    method: 'POST',
    body: {
      title: 'RAG 产品 FAQ',
      type: 'FAQ',
      sourceName: 'RAG-001-FAQ.md',
      version: 'v1',
      productId: product.payload.data.id,
      chunks: [
        { heading: 'PLA nozzle temperature', content: 'PLA nozzle temperature for RAG-001 is 205°C. Use a dry spool before printing.' },
        { heading: 'Packing', content: 'RAG-001 is packed 6 spools per carton according to the approved FAQ.' },
      ],
    },
  })
  assert.equal(draft.response.status, 201)
  assert.equal(draft.payload.data.status, 'DRAFT')

  const draftOnly = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'PLA nozzle temperature', productId: product.payload.data.id } })
  assert.equal(draftOnly.response.status, 200)
  assert.equal(draftOnly.payload.data.status, 'RAG_NOT_CONFIGURED')
  assert.deepEqual(draftOnly.payload.data.sources, [])

  const approved = await request(`/api/knowledge-documents/${draft.payload.data.id}/review`, { cookie: admin, method: 'POST', body: { status: 'APPROVED', note: '人工审核通过' } })
  assert.equal(approved.response.status, 200)
  assert.equal(approved.payload.data.status, 'APPROVED')

  const answered = await request('/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'PLA nozzle temperature', productId: product.payload.data.id } })
  assert.equal(answered.response.status, 200)
  assert.equal(answered.payload.data.mode, 'knowledge_base')
  assert.equal(answered.payload.data.status, 'ANSWERED_WITH_SOURCES')
  assert.ok(answered.payload.data.answer.includes('205°C'))
  assert.equal(answered.payload.data.sources.length, 1)
  assert.equal(answered.payload.data.sources[0].fileName, 'RAG-001-FAQ.md')
  assert.equal(answered.payload.data.sources[0].version, 'v1')

  const detail = await request(`/api/knowledge-documents/${draft.payload.data.id}`, { cookie: exec })
  assert.equal(detail.response.status, 200)
  assert.equal(detail.payload.data.chunks.length, 2)

  const expired = await request('/api/knowledge-documents', { cookie: manager, method: 'POST', body: { title: 'Expired ABS FAQ', sourceName: 'expired.md', validUntil: '2020-01-01T00:00:00.000Z', chunks: [{ heading: 'ABS enclosure', content: 'ABS enclosure guidance uses the archive-only chamber profile.' }] } })
  assert.equal(expired.response.status, 201)
  const approvedExpired = await request(`/api/knowledge-documents/${expired.payload.data.id}/review`, { cookie: admin, method: 'POST', body: { status: 'APPROVED' } })
  assert.equal(approvedExpired.response.status, 200)
  const expiredAnswer = await request('/api/rag/query', { cookie: exec, method: 'POST', body: { query: 'archive-only chamber profile' } })
  assert.equal(expiredAnswer.response.status, 200)
  assert.equal(expiredAnswer.payload.data.status, 'INSUFFICIENT_CONTEXT')
  assert.ok(!expiredAnswer.payload.data.answer.includes('archive-only'))

  const state = testMemoryState()
  assert.equal(state.knowledgeDocuments.length, 2)
  assert.equal(state.knowledgeChunks.length, 3)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'knowledge_document').length, 4)

  console.log(JSON.stringify({ result: 'passed', mode: answered.payload.data.mode, status: answered.payload.data.status, sources: answered.payload.data.sources.length, knowledgeDocuments: state.knowledgeDocuments.length, knowledgeChunks: state.knowledgeChunks.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
