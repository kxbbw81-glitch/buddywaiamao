import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-excel-audit-smoke-session-secret-0123456789abcdef'

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

  const workbook = {
    name: '中山铸融3D打印外贸报价系统V2.xlsx',
    sheets: [
      { sheet: '报价计算器', dimension: 'A1:L52', formulaCount: 89, dataValidations: 0 },
      { sheet: '物流费用', dimension: 'A1:G36', formulaCount: 24, dataValidations: 0 },
    ],
    namedRanges: [],
    dataValidations: [],
    formulaErrors: [
      { sheet: '报价计算器', cell: 'I34', cachedValue: '#VALUE!', formula: '=I31+(B31+B32+B33+B34+B35)/G7' },
      { sheet: '报价计算器', cell: 'L45', cachedValue: '#VALUE!', formula: '=K45+($B$31+$B$32+$B$33+$B$34+$B$35)*H45/$G$7/H45' },
      { sheet: '操作说明书', cell: 'B40', cachedValue: '#NAME?', formula: '=原材料成本+人工成本+制造费用+包装成本' },
    ],
    cells: [
      { sheet: '报价计算器', cell: 'B33', label: '关税 / Import Duty', value: 'DHL', formula: '=物流费用!$B$22' },
      { sheet: '报价计算器', cell: 'B35', label: '派送费 / Delivery Fee', value: 200, formula: '=物流费用!$B$28' },
    ],
  }

  const audit = await request('/api/quote-rule-sets/excel-audit', {
    cookie: manager,
    method: 'POST',
    body: {
      sourceName: 'Excel V2 报价表审计样例',
      workbook,
      suggestedCode: 'EXCEL_V2_REVIEW_DRAFT',
      proposedRules: {
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
  assert.equal(audit.response.status, 200)
  assert.equal(audit.payload.data.status, 'BLOCKED')
  assert.ok(audit.payload.data.summary.blockers >= 2)
  assert.equal(audit.payload.data.ruleDraft.canCreateRuleSet, false)
  assert.ok(audit.payload.data.issues.some((item) => item.code === 'DDP_FORMULA_ERROR'))
  assert.ok(audit.payload.data.issues.some((item) => item.code === 'TEXT_IN_NUMERIC_CHARGE'))
  assert.ok(audit.payload.data.issues.some((item) => item.code === 'NO_NAMED_RANGES'))
  assert.ok(audit.payload.data.issues.some((item) => item.code === 'NO_DATA_VALIDATIONS'))

  const cleanAudit = await request('/api/quote-rule-sets/excel-audit', {
    cookie: manager,
    method: 'POST',
    body: {
      sourceName: 'Excel V2 清洗后规则草稿',
      workbook: {
        name: 'cleaned-excel-v2.xlsx',
        sheets: [{ sheet: '报价计算器', dimension: 'A1:L52', formulaCount: 89 }],
        namedRanges: ['ProductCodes', 'TradeTerms'],
        dataValidations: [{ sheet: '报价计算器', range: 'K4', type: 'list' }],
        formulaErrors: [],
        cells: [{ sheet: '报价计算器', cell: 'B33', label: '关税 / Import Duty', value: 49.36 }],
      },
      proposedRules: { marginRate: 0.3, minimumMarginRate: 0.15 },
    },
  })
  assert.equal(cleanAudit.response.status, 200)
  assert.equal(cleanAudit.payload.data.status, 'PASS')
  assert.equal(cleanAudit.payload.data.ruleDraft.canCreateRuleSet, true)

  const salesDenied = await request('/api/quote-rule-sets/excel-audit', { cookie: sales, method: 'POST', body: { workbook: { sheets: [] } } })
  assert.equal(salesDenied.response.status, 403)
  const financeDenied = await request('/api/quote-rule-sets/excel-audit', { cookie: finance, method: 'POST', body: { workbook: { sheets: [] } } })
  assert.equal(financeDenied.response.status, 403)
  const execDenied = await request('/api/quote-rule-sets/excel-audit', { cookie: exec, method: 'POST', body: { workbook: { sheets: [] } } })
  assert.equal(execDenied.response.status, 403)

  const state = testMemoryState()
  assert.equal(state.quoteRuleSets.length, 0)
  assert.equal(state.quotes.length, 0)
  assert.equal(state.quoteVersions.length, 0)
  console.log(JSON.stringify({ result: 'passed', mode: 'excel-audit-readonly', status: audit.payload.data.status, blockers: audit.payload.data.summary.blockers, canCreateCleanDraft: cleanAudit.payload.data.ruleDraft.canCreateRuleSet }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
