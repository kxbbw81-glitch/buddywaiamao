import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-quote-rules-smoke-session-secret-0123456789abcdef'

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

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '报价规则产品' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', {
    cookie: manager,
    method: 'POST',
    body: {
      sku: 'QR-001',
      name: 'DDP 规则测试产品',
      categoryId: category.payload.data.id,
      specs: { material: 'PLA' },
      packing: { weightKg: 8.5, volumeM3: 0.05, packagingCostCny: 50 },
      costVersions: { currentUnitCostCny: 1200 },
    },
  })
  assert.equal(product.response.status, 201)

  const salesCustomer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: 'Quote Rule Buyer', country: 'US' } })
  assert.equal(salesCustomer.response.status, 201)

  const ruleSet = await request('/api/quote-rule-sets', {
    cookie: manager,
    method: 'POST',
    body: {
      code: 'EXCEL_V2_US_DDP',
      name: 'Excel V2 美国 DDP 抽象规则',
      status: 'ACTIVE',
      source: 'NexFab Excel V2 audit',
      rules: {
        fxRateCnyPerUsd: 7.85,
        marginRate: 0.3,
        minimumMarginRate: 0.15,
        charges: {
          internationalFreightUsd: 80,
          destinationPortChargesUsd: 150,
          customsClearanceUsd: 100,
          dutyRate: 0.05,
          vatRate: 0,
          deliveryFeeUsd: 200,
        },
      },
    },
  })
  assert.equal(ruleSet.response.status, 201)
  assert.equal(ruleSet.payload.data.code, 'EXCEL_V2_US_DDP')

  const salesRuleSetCreate = await request('/api/quote-rule-sets', { cookie: sales, method: 'POST', body: { code: 'SALES_SHOULD_NOT_WRITE', rules: {} } })
  assert.equal(salesRuleSetCreate.response.status, 403)

  const execRuleSetList = await request('/api/quote-rule-sets?status=ACTIVE', { cookie: exec })
  assert.equal(execRuleSetList.response.status, 200)
  assert.equal(execRuleSetList.payload.data.total, 1)

  const ddp = await request('/api/quotes/calculate', {
    cookie: sales,
    method: 'POST',
    body: {
      customerId: salesCustomer.payload.data.id,
      ruleSetId: ruleSet.payload.data.id,
      tradeTerm: 'DDP',
      items: [{ productId: product.payload.data.id, quantity: 10 }],
    },
  })
  assert.equal(ddp.response.status, 200)
  assert.equal(ddp.payload.data.tradeTerm, 'DDP')
  assert.equal(ddp.payload.data.approval.required, false)
  assert.ok(Number.isFinite(ddp.payload.data.totals.ddpTotal))
  assert.ok(ddp.payload.data.totals.ddpTotal > ddp.payload.data.totals.cifTotal)
  assert.ok(ddp.payload.data.charges.dutyUsd > 0)
  assert.equal(ddp.payload.data.lines[0].sku, 'QR-001')

  const textCharge = await request('/api/quotes/calculate', {
    cookie: sales,
    method: 'POST',
    body: {
      tradeTerm: 'DDP',
      rules: { charges: { dutyRate: 'DHL' } },
      items: [{ productId: product.payload.data.id, quantity: 10 }],
    },
  })
  assert.equal(textCharge.response.status, 400)
  assert.equal(textCharge.payload.error.code, 'VALIDATION_ERROR')

  const lowMargin = await request('/api/quotes/calculate', {
    cookie: sales,
    method: 'POST',
    body: {
      tradeTerm: 'EXW',
      rules: { marginRate: 0.05, minimumMarginRate: 0.15 },
      items: [{ productId: product.payload.data.id, quantity: 1 }],
    },
  })
  assert.equal(lowMargin.response.status, 200)
  assert.equal(lowMargin.payload.data.approval.required, true)
  assert.equal(lowMargin.payload.data.approval.reason, 'LOW_MARGIN_BELOW_MINIMUM')

  const financeDenied = await request('/api/quotes/calculate', { cookie: finance, method: 'POST', body: { tradeTerm: 'FOB', items: [{ productId: product.payload.data.id, quantity: 1 }] } })
  assert.equal(financeDenied.response.status, 403)

  const execReadOnlyCalculate = await request('/api/quotes/calculate', { cookie: exec, method: 'POST', body: { tradeTerm: 'FOB', items: [{ productId: product.payload.data.id, quantity: 1 }] } })
  assert.equal(execReadOnlyCalculate.response.status, 200)

  const unknownProduct = await request('/api/quotes/calculate', { cookie: sales, method: 'POST', body: { tradeTerm: 'FOB', items: [{ productId: 'missing-product', quantity: 1 }] } })
  assert.equal(unknownProduct.response.status, 404)

  const state = testMemoryState()
  assert.equal(state.quoteRuleSets.length, 1)
  assert.equal(state.quotes.length, 0)
  assert.equal(state.quoteVersions.length, 0)
  console.log(JSON.stringify({ result: 'passed', mode: 'quote-rules-versioned-readonly', ruleSets: state.quoteRuleSets.length, ddpTotal: ddp.payload.data.totals.ddpTotal, approvalRequired: lowMargin.payload.data.approval.required }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
