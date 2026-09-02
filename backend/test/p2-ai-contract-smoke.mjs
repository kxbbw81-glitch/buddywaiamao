import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-ai-contract-smoke-session-secret-0123456789abcdef'
delete process.env.AI_ENABLED
delete process.env.AI_PROVIDER
delete process.env.AI_DEFAULT_MODEL

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

const contractBase = {
  code: 'QUOTE_EMAIL_DRAFT',
  name: '报价邮件草稿能力',
  module: 'quote',
  level: 'L1',
  version: 'v1',
  status: 'ACTIVE',
  scenario: '报价版本锁定后，为业务员生成待人工确认的英文报价邮件草稿。',
  inputSpec: { tables: ['Quote', 'QuoteVersion'], userInput: ['tone', 'language'] },
  permissionSpec: { roles: ['SALES', 'MANAGER', 'ADMIN'], dataScope: 'customer owner/team/global' },
  outputSpec: { type: 'draft', fields: ['type', 'draft', 'limitations'] },
  validationSpec: { schema: 'QUOTE_DRAFT_OUTPUT', confidence: 'not-applicable-local-draft' },
  persistenceSpec: { aiTask: true, formalBusinessWrite: false },
  humanConfirmationSpec: { required: true, roles: ['SALES', 'MANAGER'], editableFields: ['draft'] },
  forbiddenActions: ['不得改价', '不得绕过毛利底线', '不得自动发送邮件', '不得虚构历史成交'],
  fallbackSpec: { cloudFailure: 'return 502 and keep local manual workflow', localFallback: 'manual drafting task' },
  auditSpec: { fields: ['model', 'promptVersion', 'tokens', 'cost', 'durationMs', 'operator'] },
  evalSpec: { cases: ['NORMAL', 'MISSING_CONTEXT', 'PERMISSION_DENIED'] },
  promptCode: 'QUOTE_EMAIL_DRAFT',
  promptVersion: 'v1',
  outputSchemaCode: 'QUOTE_DRAFT_OUTPUT',
  outputSchemaVersion: 'v1',
}

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const financeDenied = await request('/api/ai-output-schemas', { cookie: finance, method: 'POST', body: { code: 'DENIED', name: 'Denied', module: 'quote', schema: { type: 'object' } } })
  assert.equal(financeDenied.response.status, 403)

  const prompt = await request('/api/prompt-templates', { cookie: manager, method: 'POST', body: { code: 'QUOTE_EMAIL_DRAFT', name: '报价邮件草稿', module: 'quote', version: 'v1', status: 'ACTIVE', level: 'L1', body: '只生成待人工确认草稿，不得改价、审批或发送。' } })
  assert.equal(prompt.response.status, 201)

  const schema = await request('/api/ai-output-schemas', { cookie: manager, method: 'POST', body: { code: 'QUOTE_DRAFT_OUTPUT', name: '报价草稿输出', module: 'quote', version: 'v1', status: 'ACTIVE', schema: { type: 'object', required: ['type', 'draft', 'limitations'], properties: { type: { type: 'string' }, draft: { type: 'string' }, limitations: { type: 'array' } } } } })
  assert.equal(schema.response.status, 201)
  assert.equal(schema.payload.data.status, 'ACTIVE')

  const missingRefs = await request('/api/ai-capability-contracts', { cookie: manager, method: 'POST', body: { ...contractBase, code: 'BAD_MISSING_REFS', promptCode: null, outputSchemaCode: null } })
  assert.equal(missingRefs.response.status, 400)

  const noHuman = await request('/api/ai-capability-contracts', { cookie: manager, method: 'POST', body: { ...contractBase, code: 'BAD_NO_HUMAN', humanConfirmationSpec: { required: false } } })
  assert.equal(noHuman.response.status, 400)

  const contract = await request('/api/ai-capability-contracts', { cookie: manager, method: 'POST', body: contractBase })
  assert.equal(contract.response.status, 201)
  assert.equal(contract.payload.data.code, 'QUOTE_EMAIL_DRAFT')
  assert.equal(contract.payload.data.status, 'ACTIVE')

  const contractList = await request('/api/ai-capability-contracts?module=QUOTE&status=ACTIVE', { cookie: exec })
  assert.equal(contractList.response.status, 200)
  assert.equal(contractList.payload.data.total, 1)

  const evalSet = await request('/api/prompt-eval-sets', { cookie: manager, method: 'POST', body: { code: 'QUOTE_EMAIL_DRAFT_EVAL', name: '报价草稿最小评测集', module: 'quote', status: 'ACTIVE', promptCode: 'QUOTE_EMAIL_DRAFT', promptVersion: 'v1', capabilityCode: 'QUOTE_EMAIL_DRAFT', capabilityVersion: 'v1' } })
  assert.equal(evalSet.response.status, 201)

  const normalCase = await request(`/api/prompt-eval-sets/${evalSet.payload.data.id}/cases`, { cookie: manager, method: 'POST', body: { name: '正常报价草稿', type: 'NORMAL', input: { quoteNo: 'Q-1001', total: 1280 }, expected: { status: 'DRAFT_REQUIRES_HUMAN_CONFIRMATION' }, expectedStatus: 'SUCCEEDED', minConfidence: 0.5 } })
  assert.equal(normalCase.response.status, 201)
  const deniedCase = await request(`/api/prompt-eval-sets/${evalSet.payload.data.id}/cases`, { cookie: manager, method: 'POST', body: { name: '权限不足样例', type: 'PERMISSION_DENIED', input: { quoteNo: 'Q-PRIVATE' }, expected: { status: 403 } } })
  assert.equal(deniedCase.response.status, 201)

  const evalDetail = await request(`/api/prompt-eval-sets/${evalSet.payload.data.id}`, { cookie: exec })
  assert.equal(evalDetail.response.status, 200)
  assert.equal(evalDetail.payload.data._count.cases, 2)
  assert.equal(evalDetail.payload.data.cases, undefined)
  const evalCases = await request(`/api/prompt-eval-sets/${evalSet.payload.data.id}/cases?page=1&pageSize=1`, { cookie: exec })
  assert.equal(evalCases.response.status, 200)
  assert.equal(evalCases.payload.data.total, 2)
  assert.equal(evalCases.payload.data.items.length, 1)

  const run = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_EMAIL_DRAFT', input: { quoteNo: 'Q-1001', amount: 1280, token: 'secret-token' } } })
  assert.equal(run.response.status, 200)
  assert.equal(run.payload.data.task.capabilityCode, 'QUOTE_EMAIL_DRAFT')
  assert.equal(run.payload.data.task.outputSchemaCode, 'QUOTE_DRAFT_OUTPUT')
  assert.equal(run.payload.data.task.dataSentToCloud, false)
  assert.equal(run.payload.data.requiresHumanConfirmation, true)
  assert.ok(!JSON.stringify(run.payload.data.task.inputSummary).includes('secret-token'))

  const badSchema = await request('/api/ai-output-schemas', { cookie: manager, method: 'POST', body: { code: 'QUOTE_BAD_OUTPUT', name: '坏输出 Schema', module: 'quote', version: 'v1', status: 'ACTIVE', schema: { type: 'object', required: ['nonexistent'] } } })
  assert.equal(badSchema.response.status, 201)
  const badContract = await request('/api/ai-capability-contracts', { cookie: manager, method: 'POST', body: { ...contractBase, code: 'QUOTE_BAD_CONTRACT', outputSchemaCode: 'QUOTE_BAD_OUTPUT' } })
  assert.equal(badContract.response.status, 201)
  const schemaFail = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_BAD_CONTRACT', input: { quoteNo: 'Q-1002' } } })
  assert.equal(schemaFail.response.status, 502)
  assert.equal(schemaFail.payload.error.code, 'AI_OUTPUT_SCHEMA_FAILED')

  const invalidEvalCase = await request(`/api/prompt-eval-sets/${evalSet.payload.data.id}/cases`, { cookie: manager, method: 'POST', body: { name: 'bad confidence', type: 'NORMAL', input: {}, expected: {}, minConfidence: 2 } })
  assert.equal(invalidEvalCase.response.status, 400)

  const state = testMemoryState()
  assert.equal(state.aiOutputSchemas.length, 2)
  assert.equal(state.aiCapabilityContracts.length, 2)
  assert.equal(state.promptEvalSets.length, 1)
  assert.equal(state.promptEvalCases.length, 2)
  assert.equal(state.aiTasks.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'ai_capability_contract').length, 2)

  console.log(JSON.stringify({ result: 'passed', contracts: state.aiCapabilityContracts.length, outputSchemas: state.aiOutputSchemas.length, evalCases: state.promptEvalCases.length, aiTasks: state.aiTasks.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
