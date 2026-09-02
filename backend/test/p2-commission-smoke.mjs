import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-commission-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId, amount) {
  const result = await request('/api/quotes/quick', { cookie, method: 'POST', body: { customerId, currency: 'USD', items: [{ productId, sku: 'COM-001', name: '提成测试产品', quantity: 1, unitPrice: amount, unitCost: amount / 2 }] } })
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

async function registerAndConfirmPayment(registerCookie, financeCookie, orderId, amount) {
  const registered = await request('/api/payments', { cookie: registerCookie, method: 'POST', body: { orderId, amount, currency: 'USD', note: '提成回款' } })
  assert.equal(registered.response.status, 201)
  const confirmed = await request(`/api/payments/${registered.payload.data.id}/confirm`, { cookie: financeCookie, method: 'POST' })
  assert.equal(confirmed.response.status, 200)
  return confirmed.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '提成产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'COM-001', name: '提成测试产品', categoryId: category.payload.data.id, specs: { model: 'commission' }, packing: { carton: 10 }, costVersions: { current: 50 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sales Commission Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Commission Buyer')
  const salesOrder = await createOrder(sales, (await createQuote(sales, salesCustomer.id, product.payload.data.id, 100)).id)
  const adminOrder = await createOrder(admin, (await createQuote(admin, adminCustomer.id, product.payload.data.id, 80)).id)

  await registerAndConfirmPayment(sales, finance, salesOrder.id, 60)
  await registerAndConfirmPayment(admin, finance, adminOrder.id, 80)

  const invalidRate = await request('/api/commissions?rate=0.8', { cookie: finance })
  assert.equal(invalidRate.response.status, 400)

  const salesReport = await request('/api/commissions?rate=0.02', { cookie: sales })
  assert.equal(salesReport.response.status, 200)
  assert.equal(salesReport.payload.data.rows.length, 1)
  assert.equal(salesReport.payload.data.rows[0].salesId, 'sales-1')
  assert.equal(salesReport.payload.data.rows[0].confirmedPaidAmount, 60)
  assert.equal(salesReport.payload.data.rows[0].commissionAmount, 1.2)

  const managerReport = await request('/api/commissions?rate=0.02', { cookie: manager })
  assert.equal(managerReport.response.status, 200)
  assert.equal(managerReport.payload.data.rows.length, 1)
  assert.equal(managerReport.payload.data.rows[0].salesId, 'sales-1')

  const execReport = await request('/api/commissions?rate=0.02', { cookie: exec })
  assert.equal(execReport.response.status, 200)
  assert.equal(execReport.payload.data.stats.orderCount, 2)
  assert.equal(execReport.payload.data.stats.confirmedPaidAmount, 140)
  assert.equal(execReport.payload.data.stats.commissionAmount, 2.8)

  const salesSettle = await request('/api/commission-records/settle', { cookie: sales, method: 'POST', body: { rate: 0.02 } })
  assert.equal(salesSettle.response.status, 403)
  const managerSettle = await request('/api/commission-records/settle', { cookie: manager, method: 'POST', body: { rate: 0.02 } })
  assert.equal(managerSettle.response.status, 403)

  // 修复说明：[中危-口径同步] 结算现在要求 from/to 期间必填；测试补齐期间。
  const settled = await request('/api/commission-records/settle', { cookie: finance, method: 'POST', body: { rate: 0.02, from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z' } })
  assert.equal(settled.response.status, 201)
  assert.equal(settled.payload.data.records.length, 2)
  assert.equal(settled.payload.data.stats.commissionAmount, 2.8)
  const salesRecord = settled.payload.data.records.find((record) => record.salesId === 'sales-1')
  assert.equal(salesRecord.commissionAmount, 1.2)
  assert.equal(salesRecord.status, 'CALCULATED')
  assert.equal(salesRecord.snapshot.sourcePolicy, 'CONFIRMED_PAYMENTS_ONLY')

  const salesRecordDetail = await request(`/api/commission-records/${salesRecord.id}`, { cookie: sales })
  assert.equal(salesRecordDetail.response.status, 200)
  const managerApprove = await request(`/api/commission-records/${salesRecord.id}/approve`, { cookie: manager, method: 'POST', body: { status: 'APPROVED' } })
  assert.equal(managerApprove.response.status, 403)
  const approved = await request(`/api/commission-records/${salesRecord.id}/approve`, { cookie: finance, method: 'POST', body: { status: 'APPROVED', note: '财务确认' } })
  assert.equal(approved.response.status, 200)
  assert.equal(approved.payload.data.status, 'APPROVED')

  const salesList = await request('/api/commission-records?page=1&pageSize=10', { cookie: sales })
  assert.equal(salesList.response.status, 200)
  assert.equal(salesList.payload.data.total, 1)
  const financeList = await request('/api/commission-records?page=1&pageSize=10', { cookie: finance })
  assert.equal(financeList.response.status, 200)
  assert.equal(financeList.payload.data.total, 2)

  const state = testMemoryState()
  assert.equal(state.commissionRecords.length, 2)
  assert.equal(state.commissionRecords.filter((item) => item.status === 'APPROVED').length, 1)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'commission_record').length, 3)
  console.log(JSON.stringify({ result: 'passed', mode: 'commission-confirmed-payments', records: state.commissionRecords.length, approved: state.commissionRecords.filter((item) => item.status === 'APPROVED').length, commissionAmount: settled.payload.data.stats.commissionAmount, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
