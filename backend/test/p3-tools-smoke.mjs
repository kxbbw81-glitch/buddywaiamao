import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p3-tools-smoke-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { response, payload: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

try {
  const sales = await login('sales@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')
  const admin = await login('admin@nexfab.test')

  const customer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: 'P3 Tools Buyer', country: 'US', website: 'old-tools.example' } })
  assert.equal(customer.response.status, 201)
  const customerId = customer.payload.data.id
  const opportunity = await request('/api/opportunities', { cookie: sales, method: 'POST', body: { customerId, name: 'P3 Tools Opportunity', amount: 3000, currency: 'USD' } })
  assert.equal(opportunity.response.status, 201)

  const website = await request('/api/tools/website-link', { cookie: sales, method: 'POST', body: { customerId, website: 'https://buyer-tools.example', note: 'manual verified' } })
  assert.equal(website.response.status, 200)
  assert.equal(website.payload.data.normalizedDomain, 'buyer-tools.example')
  assert.equal(website.payload.data.customer.website, 'https://buyer-tools.example')

  const hiddenCustomer = await request('/api/customers', { cookie: admin, method: 'POST', body: { name: 'P3 Hidden Buyer', website: 'hidden-p3.example' } })
  assert.equal(hiddenCustomer.response.status, 201)
  const dedupe = await request('/api/tools/dedupe', { cookie: sales, method: 'POST', body: { website: 'hidden-p3.example' } })
  assert.equal(dedupe.response.status, 200)
  assert.equal(dedupe.payload.data.hasDuplicates, true)
  assert.equal(dedupe.payload.data.hiddenCount, 1)
  assert.equal(dedupe.payload.data.candidates.length, 0)

  const fx = await request('/api/tools/fx?from=USD&to=CNY&amount=100', { cookie: finance })
  assert.equal(fx.response.status, 200)
  assert.equal(fx.payload.data.convertedAmount, 785)
  const fxBad = await request('/api/tools/fx?from=US&to=CNY&amount=100', { cookie: sales })
  assert.equal(fxBad.response.status, 400)

  const hs = await request('/api/tools/hs?keyword=filament', { cookie: exec })
  assert.equal(hs.response.status, 200)
  assert.ok(hs.payload.data.items.some((item) => item.code === '391690'))
  const hsEmpty = await request('/api/tools/hs?keyword=unknownthing', { cookie: sales })
  assert.equal(hsEmpty.response.status, 200)
  assert.equal(hsEmpty.payload.data.total, 0)

  const ocr = await request('/api/tools/ocr', { cookie: manager, method: 'POST', body: { imageName: 'card.jpg', dryRun: true, content: 'Ana Silva\nP3 Tools Buyer Ltd\nana@buyer-tools.example\n+1 202 555 0101\nbuyer-tools.example' } })
  assert.equal(ocr.response.status, 200)
  assert.equal(ocr.payload.data.mode, 'dry-run-local-parse')
  assert.equal(ocr.payload.data.extracted.email, 'ana@buyer-tools.example')
  const ocrExternal = await request('/api/tools/ocr', { cookie: sales, method: 'POST', body: { imageName: 'card.jpg', dryRun: false } })
  assert.equal(ocrExternal.response.status, 400)

  const copy = await request('/api/tools/followup-copy', { cookie: sales, method: 'POST', body: { scenario: 'follow_up', customerId, opportunityId: opportunity.payload.data.id, product: 'PLA filament', language: 'en' } })
  assert.equal(copy.response.status, 200)
  assert.equal(copy.payload.data.mode, 'local-template')
  assert.match(copy.payload.data.copy, /P3 Tools Buyer/)

  const adminCustomer = await request('/api/customers', { cookie: admin, method: 'POST', body: { name: 'Admin Only Tool Buyer' } })
  assert.equal(adminCustomer.response.status, 201)
  const salesWebsiteForbidden = await request('/api/tools/website-link', { cookie: sales, method: 'POST', body: { customerId: adminCustomer.payload.data.id, website: 'admin-only.example' } })
  assert.equal(salesWebsiteForbidden.response.status, 403)
  const salesCopyForbidden = await request('/api/tools/followup-copy', { cookie: sales, method: 'POST', body: { scenario: 'follow_up', customerId: adminCustomer.payload.data.id, language: 'en' } })
  assert.equal(salesCopyForbidden.response.status, 403)

  const financeOcrForbidden = await request('/api/tools/ocr', { cookie: finance, method: 'POST', body: { imageName: 'card.jpg', dryRun: true } })
  assert.equal(financeOcrForbidden.response.status, 403)
  const execCopyForbidden = await request('/api/tools/followup-copy', { cookie: exec, method: 'POST', body: { scenario: 'follow_up', customerName: 'Readonly', language: 'en' } })
  assert.equal(execCopyForbidden.response.status, 403)
  const financeDedupeForbidden = await request('/api/tools/dedupe', { cookie: finance, method: 'POST', body: { companyName: 'P3 Tools Buyer' } })
  assert.equal(financeDedupeForbidden.response.status, 403)

  const state = testMemoryState()
  assert.ok(state.customerFingerprints.some((item) => item.normalized === 'buyer-tools.example'))
  assert.ok(state.auditLogs.some((item) => item.resource === 'customer_website' && item.resourceId === customerId))

  console.log(JSON.stringify({ result: 'passed', mode: 'p3-tools-center', fxConverted: fx.payload.data.convertedAmount, hsMatches: hs.payload.data.total, hiddenDedupe: dedupe.payload.data.hiddenCount, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
