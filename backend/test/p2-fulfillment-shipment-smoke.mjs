import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-fulfillment-shipment-smoke-session-secret-0123456789abcdef'

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

async function createQuote(cookie, customerId, productId, amount = 180) {
  const result = await request('/api/quotes/quick', {
    cookie,
    method: 'POST',
    body: {
      customerId,
      currency: 'USD',
      items: [{ productId, sku: 'SHIP-001', name: '物流测试产品', quantity: 6, unitPrice: amount / 6, unitCost: 13, packing: { cartonQty: 12 }, weight: { grossKg: 36 } }],
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

async function payFull(cookie, financeCookie, orderId, amount) {
  const registered = await request('/api/payments', { cookie, method: 'POST', body: { orderId, amount, currency: 'USD', note: '客户全款' } })
  assert.equal(registered.response.status, 201)
  const confirmed = await request(`/api/payments/${registered.payload.data.id}/confirm`, { cookie: financeCookie, method: 'POST' })
  assert.equal(confirmed.response.status, 200)
}

async function generateAndApprove(cookie, financeCookie, orderId, type) {
  const generated = await request(`/api/orders/${orderId}/documents/generate`, { cookie, method: 'POST', body: { type } })
  assert.equal(generated.response.status, 201)
  const approved = await request(`/api/trade-documents/${generated.payload.data.id}/review`, { cookie: financeCookie, method: 'POST', body: { status: 'APPROVED', note: 'source checked' } })
  assert.equal(approved.response.status, 200)
  return approved.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '生产物流产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'SHIP-001', name: '物流测试产品', categoryId: category.payload.data.id, specs: { model: 'ship' }, packing: { cartonQty: 12 }, costVersions: { current: 13 } } })
  assert.equal(product.response.status, 201)

  const salesCustomer = await createCustomer(sales, 'Sales Shipment Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Shipment Buyer')
  const salesOrder = await createOrder(sales, (await createQuote(sales, salesCustomer.id, product.payload.data.id, 180)).id)
  // 修复说明：[低危-口径同步] admin 报价 80 元低于成本会触发低毛利审批（锁定 202）；测试目的与毛利无关，改 180。
  const adminOrder = await createOrder(admin, (await createQuote(admin, adminCustomer.id, product.payload.data.id, 180)).id)

  const earlyProduction = await request(`/api/orders/${salesOrder.id}/fulfillment/status`, { cookie: sales, method: 'PATCH', body: { status: 'IN_PRODUCTION' } })
  assert.equal(earlyProduction.response.status, 400)
  assert.equal(earlyProduction.payload.error.code, 'FULFILLMENT_GATE_BLOCKED')

  const earlyReady = await request(`/api/orders/${salesOrder.id}/fulfillment/status`, { cookie: sales, method: 'PATCH', body: { status: 'READY_TO_SHIP' } })
  assert.equal(earlyReady.response.status, 400)
  assert.ok(earlyReady.payload.error.detail.blockers.includes('NEED_APPROVED_CI'))

  await payFull(sales, finance, salesOrder.id, 180)
  const production = await request(`/api/orders/${salesOrder.id}/fulfillment/status`, { cookie: sales, method: 'PATCH', body: { status: 'IN_PRODUCTION', note: '备货开始' } })
  assert.equal(production.response.status, 200)
  assert.equal(production.payload.data.fulfillmentStatus, 'IN_PRODUCTION')

  await generateAndApprove(sales, finance, salesOrder.id, 'PI')
  await generateAndApprove(sales, finance, salesOrder.id, 'CI')
  await generateAndApprove(sales, finance, salesOrder.id, 'PL')

  const ready = await request(`/api/orders/${salesOrder.id}/fulfillment/status`, { cookie: manager, method: 'PATCH', body: { status: 'READY_TO_SHIP', note: '单证和全款已确认' } })
  assert.equal(ready.response.status, 200)
  assert.equal(ready.payload.data.fulfillmentStatus, 'READY_TO_SHIP')

  const execShip = await request(`/api/orders/${salesOrder.id}/shipments`, { cookie: exec, method: 'POST', body: { transportMode: 'SEA', bookingNo: 'BK-001', etd: '2026-08-25T00:00:00.000Z', atd: '2026-08-26T00:00:00.000Z' } })
  assert.equal(execShip.response.status, 403)

  const salesOverreach = await request(`/api/orders/${adminOrder.id}/shipments`, { cookie: sales, method: 'POST', body: { transportMode: 'SEA', bookingNo: 'BK-OVER', etd: '2026-08-25T00:00:00.000Z', atd: '2026-08-26T00:00:00.000Z' } })
  assert.equal(salesOverreach.response.status, 403)

  const missingReference = await request(`/api/orders/${salesOrder.id}/shipments`, { cookie: sales, method: 'POST', body: { transportMode: 'SEA', etd: '2026-08-25T00:00:00.000Z', atd: '2026-08-26T00:00:00.000Z' } })
  assert.equal(missingReference.response.status, 400)

  const missingAtd = await request(`/api/orders/${salesOrder.id}/shipments`, { cookie: sales, method: 'POST', body: { transportMode: 'SEA', bookingNo: 'BK-001', etd: '2026-08-25T00:00:00.000Z' } })
  assert.equal(missingAtd.response.status, 400)

  const shipment = await request(`/api/orders/${salesOrder.id}/shipments`, {
    cookie: sales,
    method: 'POST',
    body: {
      transportMode: 'SEA',
      carrier: 'Maersk',
      bookingNo: 'BK-001',
      billOfLadingNo: 'BL-001',
      containerNo: 'CONT-001',
      etd: '2026-08-25T00:00:00.000Z',
      atd: '2026-08-26T00:00:00.000Z',
      eta: '2026-09-18T00:00:00.000Z',
    },
  })
  assert.equal(shipment.response.status, 201)
  assert.equal(shipment.payload.data.status, 'SHIPPED')

  const shippedOrder = await request(`/api/orders/${salesOrder.id}`, { cookie: sales })
  assert.equal(shippedOrder.response.status, 200)
  assert.equal(shippedOrder.payload.data.fulfillmentStatus, 'SHIPPED')

  const financeWrite = await request(`/api/shipments/${shipment.payload.data.id}/status`, { cookie: finance, method: 'PATCH', body: { status: 'DELIVERED' } })
  assert.equal(financeWrite.response.status, 403)
  const delivered = await request(`/api/shipments/${shipment.payload.data.id}/status`, { cookie: manager, method: 'PATCH', body: { status: 'DELIVERED', deliveredAt: '2026-09-20T00:00:00.000Z' } })
  assert.equal(delivered.response.status, 200)
  assert.equal(delivered.payload.data.status, 'DELIVERED')

  const deliveredOrder = await request(`/api/orders/${salesOrder.id}`, { cookie: sales })
  assert.equal(deliveredOrder.response.status, 200)
  assert.equal(deliveredOrder.payload.data.fulfillmentStatus, 'DELIVERED')

  const execList = await request('/api/shipments?page=1&pageSize=10', { cookie: exec })
  assert.equal(execList.response.status, 200)
  assert.equal(execList.payload.data.total, 1)
  const managerList = await request('/api/shipments?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 1)

  const state = testMemoryState()
  assert.equal(state.shipments.length, 1)
  assert.equal(state.shipments[0].status, 'DELIVERED')
  assert.equal(state.salesOrders.find((item) => item.id === salesOrder.id).fulfillmentStatus, 'DELIVERED')
  assert.equal(state.fulfillmentEvents.filter((item) => item.salesOrderId === salesOrder.id).length, 5)
  assert.equal(state.auditLogs.filter((item) => ['shipment', 'sales_order_fulfillment'].includes(item.resource)).length, 4)
  console.log(JSON.stringify({ result: 'passed', mode: 'production-logistics-gates', shipments: state.shipments.length, shipmentStatus: state.shipments[0].status, orderFulfillmentStatus: state.salesOrders.find((item) => item.id === salesOrder.id).fulfillmentStatus, fulfillmentEvents: state.fulfillmentEvents.filter((item) => item.salesOrderId === salesOrder.id).length, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
