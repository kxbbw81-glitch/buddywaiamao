import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-sample-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId) {
  const result = await request('/api/quotes/quick', { cookie, method: 'POST', body: { customerId, currency: 'USD', notes: 'sample linked quote', items: [{ productId, sku: 'SAMPLE-001', name: '样品测试产品', quantity: 10, unitPrice: 18, unitCost: 6 }] } })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '样品产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'SAMPLE-001', name: '样品测试产品', categoryId: category.payload.data.id, specs: {}, packing: {}, costVersions: { current: 5 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sample Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Sample Buyer')
  const salesQuote = await createQuote(sales, salesCustomer.id, product.payload.data.id)
  // 修复说明：[中危-口径同步] 样品转订单现要求报价版本已锁定；测试先锁定。
  const sampleQuoteLock = await request(`/api/quotes/${salesQuote.id}/versions/${salesQuote.versions[0].id}/lock`, { cookie: sales, method: 'POST', body: { validityDays: 30 } })
  assert.equal(sampleQuoteLock.response.status, 200)

  const sample = await request('/api/samples', {
    cookie: sales,
    method: 'POST',
    body: { customerId: salesCustomer.id, productId: product.payload.data.id, quoteId: salesQuote.id, quantity: 2, currency: 'USD', estimatedCost: 12.5, shippingAddress: 'Los Angeles', note: 'Send two test pieces' },
  })
  assert.equal(sample.response.status, 201)
  assert.equal(sample.payload.data.status, 'REQUESTED')
  assert.equal(sample.payload.data.ownerId, 'sales-1')

  const salesOverreach = await request('/api/samples', { cookie: sales, method: 'POST', body: { customerId: adminCustomer.id, productId: product.payload.data.id, quantity: 1 } })
  assert.equal(salesOverreach.response.status, 403)

  const sent = await request(`/api/samples/${sample.payload.data.id}/status`, { cookie: sales, method: 'PATCH', body: { status: 'SENT', courier: 'DHL', trackingNo: 'DHL123' } })
  assert.equal(sent.response.status, 200)
  assert.equal(sent.payload.data.status, 'SENT')
  assert.equal(sent.payload.data.courier, 'DHL')

  const delivered = await request(`/api/samples/${sample.payload.data.id}/status`, { cookie: manager, method: 'PATCH', body: { status: 'DELIVERED', note: 'Customer signed' } })
  assert.equal(delivered.response.status, 200)
  assert.equal(delivered.payload.data.status, 'DELIVERED')

  const feedback = await request(`/api/samples/${sample.payload.data.id}/status`, { cookie: sales, method: 'PATCH', body: { status: 'FEEDBACK_RECEIVED', feedback: { result: 'PASSED', rating: 5, comment: 'Approved for trial order' } } })
  assert.equal(feedback.response.status, 200)
  assert.equal(feedback.payload.data.status, 'FEEDBACK_RECEIVED')
  assert.equal(feedback.payload.data.feedback.rating, 5)

  const converted = await request(`/api/samples/${sample.payload.data.id}/convert-to-order`, { cookie: sales, method: 'POST' })
  assert.equal(converted.response.status, 201)
  assert.equal(converted.payload.data.sample.status, 'CONVERTED')
  assert.equal(converted.payload.data.sample.salesOrderId, converted.payload.data.order.id)
  assert.equal(converted.payload.data.order.quoteId, salesQuote.id)
  assert.equal(converted.payload.data.order.customerId, salesCustomer.id)

  const convertedOrder = await request(`/api/orders/${converted.payload.data.order.id}`, { cookie: sales })
  assert.equal(convertedOrder.response.status, 200)
  assert.equal(convertedOrder.payload.data.items.length, 1)
  assert.equal(convertedOrder.payload.data.items[0].productId, product.payload.data.id)

  const repeatConvert = await request(`/api/samples/${sample.payload.data.id}/convert-to-order`, { cookie: sales, method: 'POST' })
  assert.equal(repeatConvert.response.status, 409)

  const managerList = await request('/api/samples?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 1)

  const execRead = await request(`/api/samples/${sample.payload.data.id}`, { cookie: exec })
  assert.equal(execRead.response.status, 200)
  const execWrite = await request(`/api/samples/${sample.payload.data.id}/status`, { cookie: exec, method: 'PATCH', body: { status: 'CANCELLED' } })
  assert.equal(execWrite.response.status, 403)
  const execConvert = await request(`/api/samples/${sample.payload.data.id}/convert-to-order`, { cookie: exec, method: 'POST' })
  assert.equal(execConvert.response.status, 403)
  const financeRead = await request('/api/samples', { cookie: finance })
  assert.equal(financeRead.response.status, 403)

  const state = testMemoryState()
  assert.equal(state.sampleRequests.length, 1)
  assert.equal(state.salesOrders.length, 1)
  assert.equal(state.orderItems.length, 1)
  assert.equal(state.fulfillmentEvents.length, 1)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'sample_request').length, 5)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'sales_order' && item.action === 'CREATE_FROM_SAMPLE').length, 1)
  console.log(JSON.stringify({ result: 'passed', mode: 'sample-to-order', samples: state.sampleRequests.length, status: state.sampleRequests[0].status, salesOrders: state.salesOrders.length, auditLogs: state.auditLogs.filter((item) => item.resource === 'sample_request').length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
