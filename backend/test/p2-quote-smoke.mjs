import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-quote-smoke-session-secret-0123456789abcdef'

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

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '报价产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'QT-001', name: '报价测试产品', categoryId: category.payload.data.id, specs: { size: 'M' }, packing: { carton: 12 }, costVersions: { current: 6 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sales Owned Buyer')
  const salesOpportunity = await request('/api/opportunities', { cookie: sales, method: 'POST', body: { customerId: salesCustomer.id, name: 'Sales Quote Deal', amount: 1200, currency: 'USD' } })
  assert.equal(salesOpportunity.response.status, 201)
  const adminCustomer = await createCustomer(admin, 'Admin Owned Buyer')

  const adminQuote = await request('/api/quotes/quick', { cookie: admin, method: 'POST', body: { customerId: adminCustomer.id, currency: 'USD', notes: 'admin quote', items: [{ productId: product.payload.data.id, sku: 'QT-001', name: '报价测试产品', quantity: 2, unitPrice: 20, unitCost: 6 }] } })
  assert.equal(adminQuote.response.status, 201)

  const salesQuote = await request('/api/quotes/quick', { cookie: sales, method: 'POST', body: { customerId: salesCustomer.id, opportunityId: salesOpportunity.payload.data.id, currency: 'USD', notes: 'sales quote', items: [{ productId: product.payload.data.id, sku: 'QT-001', name: '报价测试产品', quantity: 3, unitPrice: 30, unitCost: 10 }] } })
  assert.equal(salesQuote.response.status, 201)
  assert.equal(salesQuote.payload.data.versions.length, 1)
  assert.equal(salesQuote.payload.data.totalAmount, 90)

  const versions = await request(`/api/quotes/${salesQuote.payload.data.id}/versions?page=1&pageSize=10`, { cookie: sales })
  assert.equal(versions.response.status, 200)
  assert.equal(versions.payload.data.total, 1)

  const salesOverreach = await request('/api/quotes/quick', { cookie: sales, method: 'POST', body: { customerId: adminCustomer.id, currency: 'USD', items: [{ name: '越权报价', quantity: 1, unitPrice: 1, unitCost: 0 }] } })
  assert.equal(salesOverreach.response.status, 403)

  const managerList = await request('/api/quotes?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 1)
  assert.equal(managerList.payload.data.items[0].id, salesQuote.payload.data.id)

  const execRead = await request(`/api/quotes/${adminQuote.payload.data.id}`, { cookie: exec })
  assert.equal(execRead.response.status, 200)
  const execWrite = await request('/api/quotes/quick', { cookie: exec, method: 'POST', body: { customerId: salesCustomer.id, currency: 'USD', items: [{ productId: product.payload.data.id, name: 'exec write', quantity: 1, unitPrice: 1 }] } })
  assert.equal(execWrite.response.status, 403)

  const financeRead = await request('/api/quotes', { cookie: finance })
  assert.equal(financeRead.response.status, 403)
  const financeWrite = await request('/api/quotes/quick', { cookie: finance, method: 'POST', body: { customerId: salesCustomer.id, currency: 'USD', items: [{ productId: product.payload.data.id, name: 'finance write', quantity: 1, unitPrice: 1 }] } })
  assert.equal(financeWrite.response.status, 403)

  const state = testMemoryState()
  assert.equal(state.quotes.length, 2)
  assert.equal(state.quoteVersions.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'quote').length, 2)
  console.log(JSON.stringify({ result: 'passed', quotes: state.quotes.length, quoteVersions: state.quoteVersions.length, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
