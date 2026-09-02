import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-payment-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId, amount = 50) {
  const result = await request('/api/quotes/quick', { cookie, method: 'POST', body: { customerId, currency: 'USD', items: [{ productId, sku: 'PAY-001', name: '回款测试产品', quantity: 1, unitPrice: amount, unitCost: 20 }] } })
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

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '回款产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'PAY-001', name: '回款测试产品', categoryId: category.payload.data.id, specs: { model: 'pay' }, packing: { carton: 8 }, costVersions: { current: 20 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sales Payment Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Payment Buyer')
  const salesOrder = await createOrder(sales, (await createQuote(sales, salesCustomer.id, product.payload.data.id, 50)).id)
  const adminOrder = await createOrder(admin, (await createQuote(admin, adminCustomer.id, product.payload.data.id, 80)).id)

  const beforeGate = await request(`/api/orders/${salesOrder.id}/gate`, { cookie: sales })
  assert.equal(beforeGate.response.status, 200)
  assert.equal(beforeGate.payload.data.pendingAmount, 50)

  const registered = await request('/api/payments', { cookie: sales, method: 'POST', body: { orderId: salesOrder.id, amount: 30, currency: 'USD', note: '客户首款' } })
  assert.equal(registered.response.status, 201)
  assert.equal(registered.payload.data.status, 'REGISTERED')

  const afterRegisterGate = await request(`/api/orders/${salesOrder.id}/gate`, { cookie: sales })
  assert.equal(afterRegisterGate.response.status, 200)
  assert.equal(afterRegisterGate.payload.data.pendingAmount, 50)

  const confirmed = await request(`/api/payments/${registered.payload.data.id}/confirm`, { cookie: finance, method: 'POST' })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.data.status, 'CONFIRMED')

  const afterConfirmGate = await request(`/api/orders/${salesOrder.id}/gate`, { cookie: sales })
  assert.equal(afterConfirmGate.response.status, 200)
  assert.equal(afterConfirmGate.payload.data.paidAmount, 30)
  assert.equal(afterConfirmGate.payload.data.pendingAmount, 20)
  assert.equal(afterConfirmGate.payload.data.paymentStatus, 'PARTIAL')

  const salesOverreach = await request('/api/payments', { cookie: sales, method: 'POST', body: { orderId: adminOrder.id, amount: 10, currency: 'USD' } })
  assert.equal(salesOverreach.response.status, 403)

  const managerList = await request('/api/payments?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 1)

  const financeRegister = await request('/api/payments', { cookie: finance, method: 'POST', body: { orderId: adminOrder.id, amount: 20, currency: 'USD', note: 'finance global register' } })
  assert.equal(financeRegister.response.status, 201)

  const financeList = await request('/api/payments?page=1&pageSize=10', { cookie: finance })
  assert.equal(financeList.response.status, 200)
  assert.equal(financeList.payload.data.total, 2)
  const execList = await request('/api/payments?page=1&pageSize=10', { cookie: exec })
  assert.equal(execList.response.status, 200)
  assert.equal(execList.payload.data.total, 2)

  const salesConfirm = await request(`/api/payments/${financeRegister.payload.data.id}/confirm`, { cookie: sales, method: 'POST' })
  assert.equal(salesConfirm.response.status, 403)
  const managerConfirm = await request(`/api/payments/${financeRegister.payload.data.id}/confirm`, { cookie: manager, method: 'POST' })
  assert.equal(managerConfirm.response.status, 403)
  const execWrite = await request('/api/payments', { cookie: exec, method: 'POST', body: { orderId: salesOrder.id, amount: 5, currency: 'USD' } })
  assert.equal(execWrite.response.status, 403)

  const adminConfirm = await request(`/api/payments/${financeRegister.payload.data.id}/confirm`, { cookie: admin, method: 'POST' })
  assert.equal(adminConfirm.response.status, 200)

  const overpay = await request('/api/payments', { cookie: finance, method: 'POST', body: { orderId: salesOrder.id, amount: 25, currency: 'USD' } })
  assert.equal(overpay.response.status, 201)
  const overpayConfirm = await request(`/api/payments/${overpay.payload.data.id}/confirm`, { cookie: finance, method: 'POST' })
  assert.equal(overpayConfirm.response.status, 400)

  const state = testMemoryState()
  assert.equal(state.orderPayments.length, 3)
  assert.equal(state.orderPayments.filter((item) => item.status === 'CONFIRMED').length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'order_payment').length, 5)
  console.log(JSON.stringify({ result: 'passed', payments: state.orderPayments.length, confirmedPayments: state.orderPayments.filter((item) => item.status === 'CONFIRMED').length, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
