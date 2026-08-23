import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-ai-gateway-smoke-session-secret-0123456789abcdef'
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

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const status = await request('/api/ai-gateway/status', { cookie: sales })
  assert.equal(status.response.status, 200)
  assert.equal(status.payload.data.enabled, false)
  assert.equal(status.payload.data.localDraft, true)
  assert.equal(status.payload.data.secretsExposed, false)
  assert.equal(status.payload.data.policy.cloudFailureStatus, 502)

  const financePromptDenied = await request('/api/prompt-templates', { cookie: finance, method: 'POST', body: { code: 'QUOTE_EMAIL_DRAFT', name: '报价邮件草稿', module: 'quote', status: 'ACTIVE', body: '只生成草稿，禁止改价。' } })
  assert.equal(financePromptDenied.response.status, 403)

  const prompt = await request('/api/prompt-templates', { cookie: manager, method: 'POST', body: { code: 'QUOTE_EMAIL_DRAFT', name: '报价邮件草稿', module: 'quote', version: 'v1', status: 'ACTIVE', level: 'L1', body: '只解释确定性报价结果并生成待确认邮件草稿，禁止改价。', outputSchema: { type: 'object', required: ['draft'] } } })
  assert.equal(prompt.response.status, 201)
  assert.equal(prompt.payload.data.code, 'QUOTE_EMAIL_DRAFT')
  assert.equal(prompt.payload.data.status, 'ACTIVE')

  const templates = await request('/api/prompt-templates?module=QUOTE&status=ACTIVE', { cookie: exec })
  assert.equal(templates.response.status, 200)
  assert.equal(templates.payload.data.total, 1)

  const draft = await request('/api/ai-gateway/run', {
    cookie: sales,
    method: 'POST',
    body: {
      module: 'quote',
      purpose: '报价邮件草稿',
      level: 'L1',
      promptCode: 'QUOTE_EMAIL_DRAFT',
      input: {
        customer: 'Acme Buyer',
        quoteNo: 'Q-1001',
        OPENAI_API_KEY: 'sk-should-not-be-stored',
        amount: 1280,
        note: '不得自动发送',
      },
    },
  })
  assert.equal(draft.response.status, 200)
  assert.equal(draft.payload.data.task.status, 'SUCCEEDED')
  assert.equal(draft.payload.data.task.provider, 'LOCAL_DRAFT')
  assert.equal(draft.payload.data.task.dataSentToCloud, false)
  assert.equal(draft.payload.data.task.promptCode, 'QUOTE_EMAIL_DRAFT')
  assert.equal(draft.payload.data.task.promptVersion, 'v1')
  assert.equal(draft.payload.data.requiresHumanConfirmation, true)
  assert.ok(draft.payload.data.output.draft.includes('需人工确认'))
  assert.ok(!JSON.stringify(draft.payload.data.task.inputSummary).includes('sk-should-not-be-stored'))

  const cloudFail = await request('/api/ai-gateway/run', { cookie: finance, method: 'POST', body: { module: 'finance', purpose: '逾期回款风险说明', provider: 'OPENAI', input: { customer: 'Finance Buyer', token: 'secret-token' } } })
  assert.equal(cloudFail.response.status, 502)
  assert.equal(cloudFail.payload.error.code, 'AI_GATEWAY_NOT_CONFIGURED')
  assert.equal(cloudFail.payload.error.detail.dataSentToCloud, false)
  assert.ok(cloudFail.payload.error.detail.aiTaskId)

  const taskDetail = await request(`/api/ai-tasks/${cloudFail.payload.error.detail.aiTaskId}`, { cookie: finance })
  assert.equal(taskDetail.response.status, 200)
  assert.equal(taskDetail.payload.data.status, 'FAILED')
  assert.equal(taskDetail.payload.data.provider, 'OPENAI')
  assert.equal(taskDetail.payload.data.dataSentToCloud, false)
  assert.ok(!JSON.stringify(taskDetail.payload.data.inputSummary).includes('secret-token'))

  const salesTasks = await request('/api/ai-tasks', { cookie: sales })
  assert.equal(salesTasks.response.status, 200)
  assert.equal(salesTasks.payload.data.total, 1)
  assert.equal(salesTasks.payload.data.items[0].createdById, 'sales-1')

  const execTasks = await request('/api/ai-tasks', { cookie: exec })
  assert.equal(execTasks.response.status, 200)
  assert.equal(execTasks.payload.data.total, 2)

  const l5Blocked = await request('/api/ai-gateway/run', { cookie: admin, method: 'POST', body: { module: 'quote', purpose: '自动审批价格', level: 'L5', input: { quoteNo: 'Q-1002' } } })
  assert.equal(l5Blocked.response.status, 400)

  const state = testMemoryState()
  assert.equal(state.promptTemplates.length, 1)
  assert.equal(state.aiTasks.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'ai_task').length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'prompt_template').length, 1)

  console.log(JSON.stringify({ result: 'passed', aiTasks: state.aiTasks.length, promptTemplates: state.promptTemplates.length, cloudFailureStatus: cloudFail.response.status, dataSentToCloud: false }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
