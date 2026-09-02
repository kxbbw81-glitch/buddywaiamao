import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-quote-lock-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId, { unitPrice, unitCost, notes }) {
  const result = await request('/api/quotes/quick', {
    cookie,
    method: 'POST',
    body: { customerId, currency: 'USD', notes, items: [{ productId, sku: 'LOCK-001', name: '锁定测试产品', quantity: 1, unitPrice, unitCost }] },
  })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '报价锁定产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'LOCK-001', name: '锁定测试产品', categoryId: category.payload.data.id, specs: {}, packing: {}, costVersions: { current: 6 } } })
  assert.equal(product.response.status, 201)
  const customer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: 'Quote Lock Buyer', country: 'US' } })
  assert.equal(customer.response.status, 201)

  const lowQuote = await createQuote(sales, customer.payload.data.id, product.payload.data.id, { unitPrice: 10, unitCost: 9, notes: 'low margin quote' })
  const lowVersion = lowQuote.versions[0]

  const lockNeedsApproval = await request(`/api/quotes/${lowQuote.id}/versions/${lowVersion.id}/lock`, { cookie: sales, method: 'POST', body: { minimumMarginRate: 0.15, note: '低毛利申请' } })
  assert.equal(lockNeedsApproval.response.status, 202)
  assert.equal(lockNeedsApproval.payload.data.status, 'APPROVAL_REQUIRED')
  assert.equal(lockNeedsApproval.payload.data.approval.status, 'PENDING')
  assert.equal(lockNeedsApproval.payload.data.margin.lowMargin, true)

  const approvals = await request(`/api/quotes/${lowQuote.id}/approvals?page=1&pageSize=10`, { cookie: manager })
  assert.equal(approvals.response.status, 200)
  assert.equal(approvals.payload.data.total, 1)
  const approvalId = approvals.payload.data.items[0].id

  const salesDecisionDenied = await request(`/api/quote-approvals/${approvalId}/decision`, { cookie: sales, method: 'POST', body: { decision: 'APPROVED' } })
  assert.equal(salesDecisionDenied.response.status, 403)

  const approved = await request(`/api/quote-approvals/${approvalId}/decision`, { cookie: manager, method: 'POST', body: { decision: 'APPROVED', note: '同意低毛利拿样' } })
  assert.equal(approved.response.status, 200)
  assert.equal(approved.payload.data.status, 'APPROVED')

  const locked = await request(`/api/quotes/${lowQuote.id}/versions/${lowVersion.id}/lock`, { cookie: sales, method: 'POST', body: { minimumMarginRate: 0.15, validityDays: 45 } })
  assert.equal(locked.response.status, 200)
  assert.equal(locked.payload.data.lockStatus, 'LOCKED')
  assert.equal(locked.payload.data.lockedById, 'sales-1')
  assert.equal(locked.payload.data.pdfSnapshot.type, 'QUOTE_PDF_SNAPSHOT')
  assert.equal(locked.payload.data.pdfSnapshot.validityDays, 45)

  const highQuote = await createQuote(sales, customer.payload.data.id, product.payload.data.id, { unitPrice: 20, unitCost: 6, notes: 'healthy margin quote' })
  const highLocked = await request(`/api/quotes/${highQuote.id}/versions/${highQuote.versions[0].id}/lock`, { cookie: sales, method: 'POST', body: { minimumMarginRate: 0.15 } })
  assert.equal(highLocked.response.status, 200)
  assert.equal(highLocked.payload.data.lockStatus, 'LOCKED')

  const financeDenied = await request(`/api/quotes/${highQuote.id}/versions/${highQuote.versions[0].id}/lock`, { cookie: finance, method: 'POST', body: {} })
  assert.equal(financeDenied.response.status, 403)
  const execDenied = await request(`/api/quotes/${highQuote.id}/versions/${highQuote.versions[0].id}/lock`, { cookie: exec, method: 'POST', body: {} })
  assert.equal(execDenied.response.status, 403)

  const state = testMemoryState()
  assert.equal(state.quoteApprovals.length, 1)
  assert.equal(state.quoteVersions.filter((item) => item.lockStatus === 'LOCKED').length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'quote_approval').length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'quote_version' && item.action === 'LOCK').length, 2)
  console.log(JSON.stringify({ result: 'passed', mode: 'quote-lock-approval', approvals: state.quoteApprovals.length, lockedVersions: state.quoteVersions.filter((item) => item.lockStatus === 'LOCKED').length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
