import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-trade-document-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId, amount = 120) {
  const result = await request('/api/quotes/quick', {
    cookie,
    method: 'POST',
    body: {
      customerId,
      currency: 'USD',
      items: [{ productId, sku: 'DOC-001', name: '单证测试产品', quantity: 3, unitPrice: amount / 3, unitCost: 11, packing: { cartonQty: 12 }, weight: { grossKg: 18 } }],
    },
  })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

async function createOrder(cookie, quoteId) {
  // 修复说明：[中危-口径同步] 转单现在要求报价版本已锁定；测试先取版本列表并锁定再转单。
  const versions = await request(`/api/quotes/${quoteId}/versions`, { cookie })
  assert.equal(versions.response.status, 200)
  const versionId = versions.payload.data.items[0].id
  const locked = await request(`/api/quotes/${quoteId}/versions/${versionId}/lock`, { cookie, method: 'POST', body: { validityDays: 30 } })
  assert.equal(locked.response.status, 200)
  const result = await request(`/api/orders/from-quote/${quoteId}`, { cookie, method: 'POST' })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

async function generateDocument(cookie, orderId, type, extra = {}) {
  const result = await request(`/api/orders/${orderId}/documents/generate`, { cookie, method: 'POST', body: { type, ...extra } })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

async function approveDocument(cookie, id) {
  const result = await request(`/api/trade-documents/${id}/review`, { cookie, method: 'POST', body: { status: 'APPROVED', note: 'source checked' } })
  assert.equal(result.response.status, 200)
  return result.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '单证产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'DOC-001', name: '单证测试产品', categoryId: category.payload.data.id, specs: { model: 'doc' }, packing: { cartonQty: 12 }, costVersions: { current: 11 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sales Document Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Document Buyer')
  const salesOrder = await createOrder(sales, (await createQuote(sales, salesCustomer.id, product.payload.data.id, 120)).id)
  const adminOrder = await createOrder(admin, (await createQuote(admin, adminCustomer.id, product.payload.data.id, 90)).id)

  const earlyReconciliation = await request(`/api/orders/${salesOrder.id}/reconciliation`, { cookie: sales })
  assert.equal(earlyReconciliation.response.status, 200)
  assert.equal(earlyReconciliation.payload.data.readyToShip, false)
  assert.ok(earlyReconciliation.payload.data.blockers.includes('NEED_APPROVED_CI'))

  const manualOverride = await request(`/api/orders/${salesOrder.id}/documents/generate`, { cookie: sales, method: 'POST', body: { type: 'PI', totalAmount: 1 } })
  assert.equal(manualOverride.response.status, 400)
  assert.equal(manualOverride.payload.error.code, 'DOCUMENT_SOURCE_LOCKED')

  const execGenerate = await request(`/api/orders/${salesOrder.id}/documents/generate`, { cookie: exec, method: 'POST', body: { type: 'PI' } })
  assert.equal(execGenerate.response.status, 403)
  const salesOverreach = await request(`/api/orders/${adminOrder.id}/documents/generate`, { cookie: sales, method: 'POST', body: { type: 'PI' } })
  assert.equal(salesOverreach.response.status, 403)

  const pi = await generateDocument(sales, salesOrder.id, 'PI')
  assert.equal(pi.type, 'PI')
  assert.equal(pi.version, 1)
  assert.equal(pi.totalAmount, 120)
  assert.equal(pi.snapshot.sourcePolicy, 'ORDER_CUSTOMER_ITEMS_CONFIRMED_PAYMENTS_ONLY')
  assert.equal(pi.snapshot.items.length, 1)

  const salesReview = await request(`/api/trade-documents/${pi.id}/review`, { cookie: sales, method: 'POST', body: { status: 'APPROVED' } })
  assert.equal(salesReview.response.status, 403)
  const approvedPi = await approveDocument(finance, pi.id)
  assert.equal(approvedPi.status, 'APPROVED')

  const ci = await approveDocument(finance, (await generateDocument(sales, salesOrder.id, 'CI')).id)
  const pl = await approveDocument(finance, (await generateDocument(sales, salesOrder.id, 'PL')).id)
  assert.equal(ci.type, 'CI')
  assert.equal(pl.type, 'PL')

  const secondPi = await generateDocument(finance, salesOrder.id, 'PI')
  assert.equal(secondPi.version, 2)
  assert.match(secondPi.documentNo, /-V2$/)

  const registered = await request('/api/payments', { cookie: sales, method: 'POST', body: { orderId: salesOrder.id, amount: 120, currency: 'USD', note: '客户全款' } })
  assert.equal(registered.response.status, 201)
  const confirmed = await request(`/api/payments/${registered.payload.data.id}/confirm`, { cookie: finance, method: 'POST' })
  assert.equal(confirmed.response.status, 200)

  const finalReconciliation = await request(`/api/orders/${salesOrder.id}/reconciliation`, { cookie: finance })
  assert.equal(finalReconciliation.response.status, 200)
  assert.equal(finalReconciliation.payload.data.readyToShip, true)
  assert.deepEqual(finalReconciliation.payload.data.blockers, [])
  assert.deepEqual(finalReconciliation.payload.data.approvedDocumentTypes.sort(), ['CI', 'PI', 'PL'])

  const execList = await request('/api/trade-documents?page=1&pageSize=10', { cookie: exec })
  assert.equal(execList.response.status, 200)
  assert.equal(execList.payload.data.total, 4)
  const managerList = await request('/api/trade-documents?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 4)

  const state = testMemoryState()
  assert.equal(state.tradeDocuments.length, 4)
  assert.equal(state.tradeDocuments.filter((item) => item.status === 'APPROVED').length, 3)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'trade_document').length, 7)
  console.log(JSON.stringify({ result: 'passed', mode: 'trade-documents-reconciliation', documents: state.tradeDocuments.length, approved: state.tradeDocuments.filter((item) => item.status === 'APPROVED').length, readyToShip: finalReconciliation.payload.data.readyToShip, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
