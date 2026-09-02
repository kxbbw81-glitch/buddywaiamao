import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-order-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId, name) {
  const result = await request('/api/quotes/quick', { cookie, method: 'POST', body: { customerId, currency: 'USD', notes: name, items: [{ productId, sku: 'ORD-001', name: '订单测试产品', quantity: 2, unitPrice: 25, unitCost: 9 }] } })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '订单产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'ORD-001', name: '订单测试产品', categoryId: category.payload.data.id, specs: { model: 'basic' }, packing: { carton: 10 }, costVersions: { current: 9 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sales Order Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Order Buyer')
  const salesQuote = await createQuote(sales, salesCustomer.id, product.payload.data.id, 'sales order quote')
  const adminQuote = await createQuote(admin, adminCustomer.id, product.payload.data.id, 'admin order quote')

  // 修复说明：[中危-口径同步] 转单现在要求报价版本已锁定；测试在转单前先锁定两个报价版本。
  for (const [cookie, quote] of [[admin, adminQuote], [sales, salesQuote]]) {
    const locked = await request(`/api/quotes/${quote.id}/versions/${quote.versions[0].id}/lock`, { cookie, method: 'POST', body: { validityDays: 30 } })
    assert.equal(locked.response.status, 200)
  }

  const adminOrder = await request(`/api/orders/from-quote/${adminQuote.id}`, { cookie: admin, method: 'POST' })
  assert.equal(adminOrder.response.status, 201)
  const salesOrder = await request(`/api/orders/from-quote/${salesQuote.id}`, { cookie: sales, method: 'POST' })
  assert.equal(salesOrder.response.status, 201)
  assert.match(salesOrder.payload.data.orderNo, /^SO-/)
  assert.equal(salesOrder.payload.data.totalAmount, 50)

  const detail = await request(`/api/orders/${salesOrder.payload.data.id}`, { cookie: sales })
  assert.equal(detail.response.status, 200)
  assert.equal(detail.payload.data.items.length, 1)

  const gate = await request(`/api/orders/${salesOrder.payload.data.id}/gate`, { cookie: sales })
  assert.equal(gate.response.status, 200)
  assert.equal(gate.payload.data.canShip, false)
  assert.equal(gate.payload.data.pendingAmount, 50)
  assert.deepEqual(gate.payload.data.requirements, ['WAITING_PAYMENT_CONFIRMATION', 'WAITING_FULFILLMENT_READY'])

  const salesOverreach = await request(`/api/orders/from-quote/${adminQuote.id}`, { cookie: sales, method: 'POST' })
  assert.equal(salesOverreach.response.status, 403)

  const managerList = await request('/api/orders?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 1)
  assert.equal(managerList.payload.data.items[0].id, salesOrder.payload.data.id)

  const financeList = await request('/api/orders?page=1&pageSize=10', { cookie: finance })
  assert.equal(financeList.response.status, 200)
  assert.equal(financeList.payload.data.total, 2)
  const execList = await request('/api/orders?page=1&pageSize=10', { cookie: exec })
  assert.equal(execList.response.status, 200)
  assert.equal(execList.payload.data.total, 2)

  const execWrite = await request(`/api/orders/from-quote/${salesQuote.id}`, { cookie: exec, method: 'POST' })
  assert.equal(execWrite.response.status, 403)
  const financeWrite = await request(`/api/orders/from-quote/${salesQuote.id}`, { cookie: finance, method: 'POST' })
  assert.equal(financeWrite.response.status, 403)

  // 修复说明：[中危-口径同步] 同一报价不允许重复转订单；重复请求现在返回 409。
  const repeated = await request(`/api/orders/from-quote/${salesQuote.id}`, { cookie: sales, method: 'POST' })
  assert.equal(repeated.response.status, 409)
  assert.equal(repeated.payload.error.code, 'QUOTE_ALREADY_CONVERTED')

  const state = testMemoryState()
  assert.equal(state.salesOrders.length, 2)
  assert.equal(state.orderItems.length, 2)
  assert.equal(state.fulfillmentEvents.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'sales_order').length, 2)
  console.log(JSON.stringify({ result: 'passed', orders: state.salesOrders.length, orderItems: state.orderItems.length, fulfillmentEvents: state.fulfillmentEvents.length, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
