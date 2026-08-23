import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-ai-policy-smoke-session-secret-0123456789abcdef'
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
  code: 'QUOTE_POLICY_DRAFT',
  name: '报价策略草稿能力',
  module: 'quote',
  level: 'L1',
  version: 'v1',
  status: 'ACTIVE',
  scenario: '按报价数据生成待人工确认草稿。',
  inputSpec: { tables: ['Quote'] },
  permissionSpec: { roles: ['SALES', 'MANAGER'] },
  outputSpec: { type: 'draft' },
  validationSpec: { schema: 'QUOTE_POLICY_OUTPUT' },
  persistenceSpec: { aiTask: true, formalBusinessWrite: false },
  humanConfirmationSpec: { required: true, roles: ['SALES', 'MANAGER'] },
  forbiddenActions: ['不得自动发送', '不得改价'],
  fallbackSpec: { cloudFailure: 'manual draft' },
  auditSpec: { fields: ['policy', 'limit', 'operator'] },
  evalSpec: { cases: ['NORMAL'] },
  promptCode: 'QUOTE_POLICY_DRAFT',
  promptVersion: 'v1',
  outputSchemaCode: 'QUOTE_POLICY_OUTPUT',
  outputSchemaVersion: 'v1',
}

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const prompt = await request('/api/prompt-templates', { cookie: manager, method: 'POST', body: { code: 'QUOTE_POLICY_DRAFT', name: '报价策略 Prompt', module: 'quote', version: 'v1', status: 'ACTIVE', level: 'L1', body: '仅生成待确认草稿。' } })
  assert.equal(prompt.response.status, 201)
  const schema = await request('/api/ai-output-schemas', { cookie: manager, method: 'POST', body: { code: 'QUOTE_POLICY_OUTPUT', name: '报价策略输出', module: 'quote', version: 'v1', status: 'ACTIVE', schema: { type: 'object', required: ['type', 'draft', 'limitations'], properties: { type: { type: 'string' }, draft: { type: 'string' }, limitations: { type: 'array' } } } } })
  assert.equal(schema.response.status, 201)
  const contract = await request('/api/ai-capability-contracts', { cookie: manager, method: 'POST', body: contractBase })
  assert.equal(contract.response.status, 201)

  const financePolicyDenied = await request('/api/ai-policy-rules', { cookie: finance, method: 'POST', body: { code: 'DENIED_POLICY', name: 'Denied', module: 'quote', blockedActions: [] } })
  assert.equal(financePolicyDenied.response.status, 403)

  const policy = await request('/api/ai-policy-rules', { cookie: manager, method: 'POST', body: { code: 'QUOTE_POLICY_GUARD', name: '报价 AI 治理策略', module: 'quote', status: 'ACTIVE', maxLevel: 'L1', allowCloud: false, allowedProviders: ['LOCAL_DRAFT'], blockedActions: ['AUTO_SEND'], requireHumanConfirmation: true, dataScopePolicy: { piiCloud: 'forbidden' } } })
  assert.equal(policy.response.status, 201)
  assert.equal(policy.payload.data.allowCloud, false)

  const policyList = await request('/api/ai-policy-rules?module=QUOTE&status=ACTIVE', { cookie: exec })
  assert.equal(policyList.response.status, 200)
  assert.equal(policyList.payload.data.total, 1)
  assert.equal(policyList.payload.data.items[0].blockedActions, undefined)
  assert.equal(policyList.payload.data.items[0].policySummary.blockedActionCount, 1)

  const ok = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_POLICY_DRAFT', action: 'DRAFT', input: { quoteNo: 'Q-POLICY-1' } } })
  assert.equal(ok.response.status, 200)
  assert.equal(ok.payload.data.task.status, 'SUCCEEDED')
  assert.equal(ok.payload.data.task.dataSentToCloud, false)

  const blockedAction = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_POLICY_DRAFT', action: 'AUTO_SEND', input: { quoteNo: 'Q-POLICY-2' } } })
  assert.equal(blockedAction.response.status, 403)
  assert.equal(blockedAction.payload.error.code, 'AI_POLICY_BLOCKED')
  assert.ok(blockedAction.payload.error.detail.aiTaskId)

  const blockedLevel = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_POLICY_DRAFT', level: 'L2', action: 'DRAFT', input: { quoteNo: 'Q-POLICY-3' } } })
  assert.equal(blockedLevel.response.status, 400)
  assert.equal(blockedLevel.payload.error.code, 'CAPABILITY_LEVEL_MISMATCH')

  const cloudBlocked = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_POLICY_DRAFT', provider: 'OPENAI', action: 'DRAFT', input: { quoteNo: 'Q-POLICY-4' } } })
  assert.equal(cloudBlocked.response.status, 403)
  assert.equal(cloudBlocked.payload.error.code, 'AI_POLICY_BLOCKED')
  assert.equal(cloudBlocked.payload.error.detail.dataSentToCloud, false)

  const financeLimitDenied = await request('/api/ai-cost-limits', { cookie: finance, method: 'POST', body: { code: 'DENIED_LIMIT', name: 'Denied', module: 'quote' } })
  assert.equal(financeLimitDenied.response.status, 403)
  const limit = await request('/api/ai-cost-limits', { cookie: manager, method: 'POST', body: { code: 'QUOTE_TINY_RUN_LIMIT', name: '报价单次 tiny token 限额', module: 'quote', status: 'ACTIVE', period: 'RUN', maxTokens: 1, maxCost: 0, hardBlock: true } })
  assert.equal(limit.response.status, 201)
  assert.equal(limit.payload.data.period, 'RUN')

  const limitList = await request('/api/ai-cost-limits?module=QUOTE&status=ACTIVE', { cookie: exec })
  assert.equal(limitList.response.status, 200)
  assert.equal(limitList.payload.data.total, 1)
  assert.equal(limitList.payload.data.items[0].maxTokens, 1)

  const tokenBlocked = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_POLICY_DRAFT', action: 'DRAFT', input: { quoteNo: 'Q-POLICY-5' } } })
  assert.equal(tokenBlocked.response.status, 403)
  assert.equal(tokenBlocked.payload.error.code, 'AI_COST_LIMIT_EXCEEDED')
  assert.ok(tokenBlocked.payload.error.detail.estimatedInputTokens > 1)

  const state = testMemoryState()
  assert.equal(state.aiPolicyRules.length, 1)
  assert.equal(state.aiCostLimits.length, 1)
  assert.equal(state.aiTasks.length, 4)
  assert.equal(state.aiTasks.filter((item) => item.status === 'FAILED').length, 3)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'ai_policy_rule').length, 1)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'ai_cost_limit').length, 1)

  console.log(JSON.stringify({ result: 'passed', policyRules: state.aiPolicyRules.length, costLimits: state.aiCostLimits.length, aiTasks: state.aiTasks.length, failedTasks: state.aiTasks.filter((item) => item.status === 'FAILED').length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
