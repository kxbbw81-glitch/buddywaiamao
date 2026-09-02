import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-quote-send-smoke-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body, raw = false } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  if (raw) return { response, buffer: Buffer.from(await response.arrayBuffer()), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  return { response, payload: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '报价发送产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'SEND-001', name: '发送测试产品', categoryId: category.payload.data.id, specs: {}, packing: {}, costVersions: { current: 8 } } })
  assert.equal(product.response.status, 201)
  const customer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: 'Quote Send Buyer', country: 'US' } })
  assert.equal(customer.response.status, 201)

  const quote = await request('/api/quotes/quick', {
    cookie: sales,
    method: 'POST',
    body: { customerId: customer.payload.data.id, currency: 'USD', notes: 'send quote', items: [{ productId: product.payload.data.id, sku: 'SEND-001', name: '发送测试产品', quantity: 2, unitPrice: 30, unitCost: 8 }] },
  })
  assert.equal(quote.response.status, 201)
  const version = quote.payload.data.versions[0]

  const unlockedPdf = await request(`/api/quotes/${quote.payload.data.id}/versions/${version.id}/pdf`, { cookie: sales })
  assert.equal(unlockedPdf.response.status, 400)

  const locked = await request(`/api/quotes/${quote.payload.data.id}/versions/${version.id}/lock`, { cookie: sales, method: 'POST', body: { minimumMarginRate: 0.15, validityDays: 30 } })
  assert.equal(locked.response.status, 200)
  assert.equal(locked.payload.data.lockStatus, 'LOCKED')

  const pdf = await request(`/api/quotes/${quote.payload.data.id}/versions/${version.id}/pdf`, { cookie: sales, raw: true })
  assert.equal(pdf.response.status, 200)
  assert.equal(pdf.response.headers.get('content-type'), 'application/pdf')
  assert.equal(pdf.buffer.subarray(0, 4).toString('utf8'), '%PDF')
  assert.ok(pdf.buffer.length > 500)

  const missingConfirmation = await request(`/api/quotes/${quote.payload.data.id}/send`, { cookie: sales, method: 'POST', body: { versionId: version.id, channel: 'EMAIL', recipient: 'buyer@example.com' } })
  assert.equal(missingConfirmation.response.status, 400)

  const sent = await request(`/api/quotes/${quote.payload.data.id}/send`, {
    cookie: sales,
    method: 'POST',
    body: { versionId: version.id, channel: 'EMAIL', recipient: 'buyer@example.com', subject: 'NexFab quotation SEND-001', message: 'Manual email sent with PDF attached.', confirmedExternalSend: true },
  })
  assert.equal(sent.response.status, 200)
  assert.equal(sent.payload.data.status, 'SENT_RECORDED')
  assert.equal(sent.payload.data.communicationEvent.type, 'EMAIL')
  assert.equal(sent.payload.data.communicationEvent.direction, 'OUTBOUND')

  const timeline = await request(`/api/timeline?customerId=${customer.payload.data.id}&type=EMAIL`, { cookie: sales })
  assert.equal(timeline.response.status, 200)
  assert.equal(timeline.payload.data.total, 1)

  const quoteAfterSend = await request(`/api/quotes/${quote.payload.data.id}`, { cookie: sales })
  assert.equal(quoteAfterSend.response.status, 200)
  assert.equal(quoteAfterSend.payload.data.status, 'SENT')

  const financeDenied = await request(`/api/quotes/${quote.payload.data.id}/send`, { cookie: finance, method: 'POST', body: { versionId: version.id, confirmedExternalSend: true } })
  assert.equal(financeDenied.response.status, 403)

  const state = testMemoryState()
  assert.equal(state.communicationEvents.length, 1)
  assert.equal(state.quotes[0].status, 'SENT')
  assert.equal(state.auditLogs.filter((item) => item.action === 'SEND' && item.resource === 'quote').length, 1)
  console.log(JSON.stringify({ result: 'passed', mode: 'quote-pdf-send-record', pdfBytes: pdf.buffer.length, communicationEvents: state.communicationEvents.length, quoteStatus: state.quotes[0].status }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
