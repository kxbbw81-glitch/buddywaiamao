import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'

const root = new URL('../../', import.meta.url)
const backendDir = new URL('backend/', root)
const frontendDir = new URL('frontend/', root)

async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  await once(server, 'close')
  return port
}

function start(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', (chunk) => { log += chunk.toString() })
  child.stderr.on('data', (chunk) => { log += chunk.toString() })
  child.log = () => log.slice(-6000)
  return child
}

function ensureFrontendBuild() {
  const buildId = new URL('.next/BUILD_ID', frontendDir)
  if (existsSync(buildId)) return
  const result = spawnSync('npx', ['next', 'build'], {
    cwd: frontendDir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`next build failed before integration test:\n${result.stdout}\n${result.stderr}`)
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const exited = once(child, 'exit').then(() => true)
  const timedOut = new Promise((resolve) => setTimeout(() => resolve(false), 5000))
  if (!(await Promise.race([exited, timedOut]))) {
    child.kill('SIGKILL')
    await once(child, 'exit').catch(() => undefined)
  }
}

async function waitFor(url, attempts = 120) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url)
      if (response.status < 500) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

async function request(base, path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(base, email) {
  const result = await request(base, '/api/backend/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.cookie)
  return result.cookie
}

async function createQuote(base, cookie, customerId, product) {
  const quote = await request(base, '/api/backend/api/quotes/quick', {
    cookie,
    method: 'POST',
    body: { customerId, currency: 'USD', notes: 'P1.3 flow quote', items: [{ productId: product.id, sku: product.sku, name: product.name, quantity: 2, unitPrice: 90, unitCost: 30 }] },
  })
  assert.equal(quote.response.status, 201)
  return quote.payload.data
}

async function generateAndApprove(base, salesCookie, financeCookie, orderId, type) {
  const generated = await request(base, `/api/backend/api/orders/${orderId}/documents/generate`, { cookie: salesCookie, method: 'POST', body: { type } })
  assert.equal(generated.response.status, 201)
  const approved = await request(base, `/api/backend/api/trade-documents/${generated.payload.data.id}/review`, { cookie: financeCookie, method: 'POST', body: { status: 'APPROVED', note: 'source checked' } })
  assert.equal(approved.response.status, 200)
  assert.equal(approved.payload.data.status, 'APPROVED')
  return approved.payload.data
}

const componentSource = readFileSync(new URL('../src/components/p1-fulfillment-flow-view.tsx', import.meta.url), 'utf8')
for (const expected of ['样品创建、进度、反馈、转订单', '报价转订单', '收款登记与财务确认', 'PI / CI / PL / SC', '质检完成 / 待发货', '创建发货', '签收']) {
  assert.ok(componentSource.includes(expected), `P1.3 UI missing label: ${expected}`)
}
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
for (const expected of ['/api/samples', '/api/orders/from-quote', '/api/payments', '/documents/generate', '/api/trade-documents', '/api/shipments']) {
  assert.ok(apiSource.includes(expected), `P1.3 API client missing endpoint: ${expected}`)
}

const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], {
  cwd: backendDir,
  env: { ...process.env, NODE_ENV: 'test', NEXFAB_MEMORY_TEST_DB: 'true', SESSION_SECRET: 'p1-fulfillment-flow-secret-0123456789abcdef', PORT: String(backendPort) },
})
let frontend

try {
  await waitFor(`http://127.0.0.1:${backendPort}/health`)
  ensureFrontendBuild()
  frontend = start('npx', ['next', 'start', '--hostname', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: frontendDir,
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}`, NEXT_TELEMETRY_DISABLED: '1' },
  })
  const appBase = `http://127.0.0.1:${frontendPort}`
  await waitFor(appBase)

  const manager = await login(appBase, 'manager@nexfab.test')
  const sales = await login(appBase, 'sales@nexfab.test')
  const finance = await login(appBase, 'finance@nexfab.test')
  const exec = await login(appBase, 'exec@nexfab.test')

  const nav = await request(appBase, '/api/backend/api/navigation', { cookie: sales })
  assert.equal(nav.response.status, 200)
  assert.ok(nav.payload.data.modules.some((item) => item.id === 'fulfillment'))

  const category = await request(appBase, '/api/backend/api/product-categories', { cookie: manager, method: 'POST', body: { name: 'P1.3 Flow Category' } })
  assert.equal(category.response.status, 201)
  const product = await request(appBase, '/api/backend/api/products', { cookie: manager, method: 'POST', body: { sku: 'P13-001', name: 'P1.3 Flow Product', categoryId: category.payload.data.id, specs: { model: 'p13' }, packing: { packing: 'carton', weight: 2 }, costVersions: { current: 30 } } })
  assert.equal(product.response.status, 201)
  const customer = await request(appBase, '/api/backend/api/customers', { cookie: sales, method: 'POST', body: { name: 'P1.3 Flow Buyer', country: 'US' } })
  assert.equal(customer.response.status, 201)
  const quote = await createQuote(appBase, sales, customer.payload.data.id, product.payload.data)

  const sample = await request(appBase, '/api/backend/api/samples', { cookie: sales, method: 'POST', body: { customerId: customer.payload.data.id, productId: product.payload.data.id, quoteId: quote.id, quantity: 2, currency: 'USD', estimatedCost: 60, shippingAddress: 'Customer address' } })
  assert.equal(sample.response.status, 201)
  assert.equal(sample.payload.data.status, 'REQUESTED')

  const earlyConvert = await request(appBase, `/api/backend/api/samples/${sample.payload.data.id}/convert-to-order`, { cookie: sales, method: 'POST' })
  assert.equal(earlyConvert.response.status, 400)
  assert.equal(earlyConvert.payload.error.code, 'SAMPLE_FEEDBACK_REQUIRED')

  const execSampleWrite = await request(appBase, `/api/backend/api/samples/${sample.payload.data.id}/status`, { cookie: exec, method: 'PATCH', body: { status: 'CANCELLED' } })
  assert.equal(execSampleWrite.response.status, 403)
  const financeSamples = await request(appBase, '/api/backend/api/samples', { cookie: finance })
  assert.equal(financeSamples.response.status, 403)

  const sampleSent = await request(appBase, `/api/backend/api/samples/${sample.payload.data.id}/status`, { cookie: sales, method: 'PATCH', body: { status: 'SENT', courier: 'Carrier', trackingNo: 'TRACK-P13' } })
  assert.equal(sampleSent.response.status, 200)
  const sampleDelivered = await request(appBase, `/api/backend/api/samples/${sample.payload.data.id}/status`, { cookie: manager, method: 'PATCH', body: { status: 'DELIVERED', note: 'signed' } })
  assert.equal(sampleDelivered.response.status, 200)
  const sampleFeedback = await request(appBase, `/api/backend/api/samples/${sample.payload.data.id}/status`, { cookie: sales, method: 'PATCH', body: { status: 'FEEDBACK_RECEIVED', feedback: { result: 'PASSED', approved: true, comment: 'approved' } } })
  assert.equal(sampleFeedback.response.status, 200)

  const converted = await request(appBase, `/api/backend/api/samples/${sample.payload.data.id}/convert-to-order`, { cookie: sales, method: 'POST' })
  assert.equal(converted.response.status, 201)
  assert.equal(converted.payload.data.sample.status, 'CONVERTED')
  const order = converted.payload.data.order
  assert.equal(order.quoteId, quote.id)

  const orderDetail = await request(appBase, `/api/backend/api/orders/${order.id}`, { cookie: sales })
  assert.equal(orderDetail.response.status, 200)
  assert.equal(orderDetail.payload.data.items.length, 1)

  const directQuote = await createQuote(appBase, sales, customer.payload.data.id, product.payload.data)
  const directOrder = await request(appBase, `/api/backend/api/orders/from-quote/${directQuote.id}`, { cookie: sales, method: 'POST' })
  assert.equal(directOrder.response.status, 201)
  assert.match(directOrder.payload.data.orderNo, /^SO-/)

  const earlyProduction = await request(appBase, `/api/backend/api/orders/${order.id}/fulfillment/status`, { cookie: sales, method: 'PATCH', body: { status: 'IN_PRODUCTION' } })
  assert.equal(earlyProduction.response.status, 400)
  assert.equal(earlyProduction.payload.error.code, 'FULFILLMENT_GATE_BLOCKED')

  const payment = await request(appBase, '/api/backend/api/payments', { cookie: sales, method: 'POST', body: { orderId: order.id, amount: 180, currency: 'USD', note: 'full payment' } })
  assert.equal(payment.response.status, 201)
  assert.equal(payment.payload.data.status, 'REGISTERED')
  const salesConfirm = await request(appBase, `/api/backend/api/payments/${payment.payload.data.id}/confirm`, { cookie: sales, method: 'POST' })
  assert.equal(salesConfirm.response.status, 403)
  const confirmed = await request(appBase, `/api/backend/api/payments/${payment.payload.data.id}/confirm`, { cookie: finance, method: 'POST' })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.data.status, 'CONFIRMED')

  const production = await request(appBase, `/api/backend/api/orders/${order.id}/fulfillment/status`, { cookie: sales, method: 'PATCH', body: { status: 'IN_PRODUCTION', note: 'production started' } })
  assert.equal(production.response.status, 200)
  assert.equal(production.payload.data.fulfillmentStatus, 'IN_PRODUCTION')

  const earlyReady = await request(appBase, `/api/backend/api/orders/${order.id}/fulfillment/status`, { cookie: sales, method: 'PATCH', body: { status: 'READY_TO_SHIP' } })
  assert.equal(earlyReady.response.status, 400)
  assert.ok(earlyReady.payload.error.detail.blockers.includes('NEED_APPROVED_CI'))

  const manualOverride = await request(appBase, `/api/backend/api/orders/${order.id}/documents/generate`, { cookie: sales, method: 'POST', body: { type: 'PI', totalAmount: 1 } })
  assert.equal(manualOverride.response.status, 400)
  assert.equal(manualOverride.payload.error.code, 'DOCUMENT_SOURCE_LOCKED')
  const execGenerate = await request(appBase, `/api/backend/api/orders/${order.id}/documents/generate`, { cookie: exec, method: 'POST', body: { type: 'PI' } })
  assert.equal(execGenerate.response.status, 403)

  const pi = await generateAndApprove(appBase, sales, finance, order.id, 'PI')
  const ci = await generateAndApprove(appBase, sales, finance, order.id, 'CI')
  const pl = await generateAndApprove(appBase, sales, finance, order.id, 'PL')
  assert.equal(pi.type, 'PI')
  assert.equal(ci.type, 'CI')
  assert.equal(pl.type, 'PL')

  const reconciliation = await request(appBase, `/api/backend/api/orders/${order.id}/reconciliation`, { cookie: finance })
  assert.equal(reconciliation.response.status, 200)
  assert.equal(reconciliation.payload.data.readyToShip, true)
  assert.deepEqual(reconciliation.payload.data.blockers, [])

  const ready = await request(appBase, `/api/backend/api/orders/${order.id}/fulfillment/status`, { cookie: manager, method: 'PATCH', body: { status: 'READY_TO_SHIP', note: 'QC passed and documents/payment ready' } })
  assert.equal(ready.response.status, 200)
  assert.equal(ready.payload.data.fulfillmentStatus, 'READY_TO_SHIP')

  const missingShipmentReference = await request(appBase, `/api/backend/api/orders/${order.id}/shipments`, { cookie: sales, method: 'POST', body: { transportMode: 'SEA', etd: '2026-08-25T00:00:00.000Z', atd: '2026-08-26T00:00:00.000Z' } })
  assert.equal(missingShipmentReference.response.status, 400)
  const shipment = await request(appBase, `/api/backend/api/orders/${order.id}/shipments`, { cookie: sales, method: 'POST', body: { transportMode: 'SEA', carrier: 'Carrier', bookingNo: 'BK-P13', billOfLadingNo: 'BL-P13', containerNo: 'CONT-P13', etd: '2026-08-25T00:00:00.000Z', atd: '2026-08-26T00:00:00.000Z', eta: '2026-09-18T00:00:00.000Z' } })
  assert.equal(shipment.response.status, 201)
  assert.equal(shipment.payload.data.status, 'SHIPPED')
  const financeShipmentWrite = await request(appBase, `/api/backend/api/shipments/${shipment.payload.data.id}/status`, { cookie: finance, method: 'PATCH', body: { status: 'DELIVERED' } })
  assert.equal(financeShipmentWrite.response.status, 403)
  const delivered = await request(appBase, `/api/backend/api/shipments/${shipment.payload.data.id}/status`, { cookie: manager, method: 'PATCH', body: { status: 'DELIVERED', deliveredAt: '2026-09-20T00:00:00.000Z' } })
  assert.equal(delivered.response.status, 200)
  assert.equal(delivered.payload.data.status, 'DELIVERED')

  const deliveredOrder = await request(appBase, `/api/backend/api/orders/${order.id}`, { cookie: sales })
  assert.equal(deliveredOrder.response.status, 200)
  assert.equal(deliveredOrder.payload.data.fulfillmentStatus, 'DELIVERED')

  console.log(JSON.stringify({ result: 'passed', mode: 'p1-fulfillment-flow-frontend', sampleStatus: 'CONVERTED', orderFulfillmentStatus: deliveredOrder.payload.data.fulfillmentStatus, paymentStatus: confirmed.payload.data.status, documentsApproved: 3, reconciliationReady: reconciliation.payload.data.readyToShip, shipmentStatus: delivered.payload.data.status, blocks: ['SAMPLE_FEEDBACK_REQUIRED', 'FULFILLMENT_GATE_BLOCKED', 'DOCUMENT_SOURCE_LOCKED'], denied: { execSampleWrite: 403, financeSamples: 403, salesConfirm: 403, execGenerate: 403, financeShipmentWrite: 403 } }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  await stopProcess(frontend)
  await stopProcess(backend)
}
