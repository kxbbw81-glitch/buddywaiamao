import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p1-import-templates-session-secret-0123456789abcdef'

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
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')

  const templates = await request('/api/import/templates', { cookie: manager })
  assert.equal(templates.response.status, 200)
  assert.equal(templates.payload.data.total, 5)
  assert.ok(templates.payload.data.items.every((item) => item.noBusinessSampleData === true && item.csvHeader && item.columns.length > 0))
  const productTemplate = await request('/api/import/templates/products', { cookie: manager })
  assert.equal(productTemplate.response.status, 200)
  assert.equal(productTemplate.payload.data.csvHeader.includes('sku'), true)
  assert.equal(productTemplate.payload.data.csvDictionary.includes('P14-'), false)

  const leadRows = [{ source: 'CSV', companyName: 'P1.4 导入线索', contactName: 'Import Contact', email: 'p14-lead@example.test', phone: '+1 202 555 0101' }]
  const leadPreview = await request('/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: true, rows: leadRows } })
  assert.equal(leadPreview.response.status, 200)
  assert.equal(leadPreview.payload.data.dryRun, true)
  assert.equal(leadPreview.payload.data.created[0].preview, true)
  assert.equal(testMemoryState().leads.length, 0)
  const leadConfirm = await request('/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: false, confirmImport: true, rows: leadRows } })
  assert.equal(leadConfirm.response.status, 200)
  assert.equal(leadConfirm.payload.data.summary.created, 1)
  assert.equal(testMemoryState().leads[0].email, null)
  assert.ok(testMemoryState().leads[0].emailCiphertext)
  const unconfirmedLead = await request('/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: false, rows: leadRows } })
  assert.equal(unconfirmedLead.response.status, 400)

  const privateCustomer = await request('/api/customers', { cookie: admin, method: 'POST', body: { name: '私有导入查重客户' } })
  assert.equal(privateCustomer.response.status, 201)
  const privateContact = await request(`/api/customers/${privateCustomer.payload.data.id}/contacts`, { cookie: admin, method: 'POST', body: { name: 'Private', email: 'private-import@example.test' } })
  assert.equal(privateContact.response.status, 201)
  const hiddenPreview = await request('/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: true, rows: [{ source: 'CSV', companyName: '同邮箱但不可见', email: 'private-import@example.test' }] } })
  assert.equal(hiddenPreview.response.status, 200)
  assert.equal(JSON.stringify(hiddenPreview.payload.data).includes(privateCustomer.payload.data.id), false)
  assert.equal(JSON.stringify(hiddenPreview.payload.data).includes('hiddenCount'), false)

  const customerRows = [{ name: 'P1.4 导入客户', country: 'US', contactName: 'Buyer', email: 'p14-customer@example.test' }]
  const customerPreview = await request('/api/import/customers', { cookie: sales, method: 'POST', body: { dryRun: true, rows: customerRows } })
  assert.equal(customerPreview.response.status, 200)
  assert.equal(customerPreview.payload.data.created[0].preview, true)
  const customerConfirm = await request('/api/import/customers', { cookie: sales, method: 'POST', body: { dryRun: false, confirmImport: true, rows: customerRows } })
  assert.equal(customerConfirm.response.status, 200)
  assert.equal(customerConfirm.payload.data.summary.created, 1)

  const productRows = [{ sku: 'P14-001', name: 'P1.4 导入产品', categoryName: 'P1.4 分类', specsJson: '{"material":"generic"}', packingJson: '{"weightKg":1}', costVersionsJson: '{"current":8.5}' }]
  const productPreview = await request('/api/import/products', { cookie: manager, method: 'POST', body: { dryRun: true, rows: productRows } })
  assert.equal(productPreview.response.status, 200)
  assert.equal(productPreview.payload.data.created[0].preview, true)
  const productConfirm = await request('/api/import/products', { cookie: manager, method: 'POST', body: { dryRun: false, confirmImport: true, rows: productRows } })
  assert.equal(productConfirm.response.status, 200)
  assert.equal(productConfirm.payload.data.summary.created, 1)
  const costPreview = await request('/api/import/supplier-costs', { cookie: manager, method: 'POST', body: { dryRun: true, rows: [{ sku: 'P14-001', supplierName: 'P1.4 供应商', cost: 7.5, currency: 'CNY' }] } })
  assert.equal(costPreview.response.status, 200)
  assert.equal(costPreview.payload.data.updated[0].preview, true)
  const costConfirm = await request('/api/import/supplier-costs', { cookie: manager, method: 'POST', body: { dryRun: false, confirmImport: true, rows: [{ sku: 'P14-001', supplierName: 'P1.4 供应商', cost: 7.5, currency: 'CNY' }] } })
  assert.equal(costConfirm.response.status, 200)
  assert.equal(costConfirm.payload.data.summary.updated, 1)

  const ruleRows = [{ code: 'P14-RULE', name: 'P1.4 通用报价规则', status: 'DRAFT', rulesJson: JSON.stringify({ code: 'P14-RULE', currency: 'USD', fxRateCnyPerUsd: 7.85, marginRate: 0.25, minimumMarginRate: 0.15 }) }]
  const rulePreview = await request('/api/import/quote-rules', { cookie: manager, method: 'POST', body: { dryRun: true, rows: ruleRows } })
  assert.equal(rulePreview.response.status, 200)
  assert.equal(rulePreview.payload.data.created[0].preview, true)
  const ruleConfirm = await request('/api/import/quote-rules', { cookie: manager, method: 'POST', body: { dryRun: false, confirmImport: true, rows: ruleRows } })
  assert.equal(ruleConfirm.response.status, 200)
  assert.equal(ruleConfirm.payload.data.summary.created, 1)

  const financeDenied = await request('/api/import/leads', { cookie: finance, method: 'POST', body: { dryRun: true, rows: leadRows } })
  assert.equal(financeDenied.response.status, 403)
  const salesProductDenied = await request('/api/import/products', { cookie: sales, method: 'POST', body: { dryRun: true, rows: productRows } })
  assert.equal(salesProductDenied.response.status, 403)
  const salesRuleDenied = await request('/api/import/quote-rules', { cookie: sales, method: 'POST', body: { dryRun: true, rows: ruleRows } })
  assert.equal(salesRuleDenied.response.status, 403)

  console.log(JSON.stringify({ result: 'passed', mode: 'p1-import-templates', templates: templates.payload.data.total, leads: testMemoryState().leads.length, customers: testMemoryState().customers.length, products: testMemoryState().products.length, quoteRules: testMemoryState().quoteRuleSets.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
