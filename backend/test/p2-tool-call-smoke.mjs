import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-tool-call-smoke-session-secret-0123456789abcdef'
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
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const aiRun = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { module: 'communication', purpose: '客户回复邮件草稿', input: { customer: 'Tool Buyer', topic: 'quote follow-up', token: 'secret-token' } } })
  assert.equal(aiRun.response.status, 200)
  assert.equal(aiRun.payload.data.task.module, 'COMMUNICATION')
  const aiTaskId = aiRun.payload.data.task.id

  const financeDenied = await request('/api/tool-calls', { cookie: finance, method: 'POST', body: { module: 'communication', toolName: 'email_connector', action: 'send_email', input: { to: 'buyer@example.com' } } })
  assert.equal(financeDenied.response.status, 403)

  const autoExecuteDenied = await request('/api/tool-calls', { cookie: sales, method: 'POST', body: { module: 'communication', toolName: 'email_connector', action: 'send_email', executeNow: true, input: { to: 'buyer@example.com' } } })
  assert.equal(autoExecuteDenied.response.status, 400)
  assert.equal(autoExecuteDenied.payload.error.code, 'TOOL_EXECUTION_NOT_SUPPORTED')

  const noHumanDenied = await request('/api/tool-calls', { cookie: sales, method: 'POST', body: { module: 'communication', toolName: 'email_connector', action: 'send_email', requiresHumanConfirmation: false, input: { to: 'buyer@example.com' } } })
  assert.equal(noHumanDenied.response.status, 400)
  assert.equal(noHumanDenied.payload.error.code, 'HUMAN_CONFIRMATION_REQUIRED')

  const wrongModule = await request('/api/tool-calls', { cookie: sales, method: 'POST', body: { aiTaskId, module: 'quote', toolName: 'email_connector', action: 'send_email', input: { to: 'buyer@example.com' } } })
  assert.equal(wrongModule.response.status, 400)
  assert.equal(wrongModule.payload.error.code, 'TOOL_CALL_MODULE_MISMATCH')

  const created = await request('/api/tool-calls', {
    cookie: sales,
    method: 'POST',
    body: {
      aiTaskId,
      module: 'communication',
      toolName: 'email_connector',
      action: 'send_email',
      riskLevel: 'high',
      input: { to: 'buyer@example.com', subject: 'Quote follow-up', draftOnly: true, authorization: 'Bearer secret-token' },
    },
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.payload.data.status, 'PENDING_CONFIRMATION')
  assert.equal(created.payload.data.requiresHumanConfirmation, true)
  assert.ok(!JSON.stringify(created.payload.data.inputSummary).includes('secret-token'))
  assert.ok(!JSON.stringify(created.payload.data.inputSummary).includes('buyer@example.com'))

  const toolCallId = created.payload.data.id
  const list = await request('/api/tool-calls?module=COMMUNICATION&pageSize=1', { cookie: exec })
  assert.equal(list.response.status, 200)
  assert.equal(list.payload.data.total, 1)
  assert.equal(list.payload.data.items[0].inputSummary, undefined)

  const detail = await request(`/api/tool-calls/${toolCallId}`, { cookie: sales })
  assert.equal(detail.response.status, 200)
  assert.equal(detail.payload.data.inputSummary.to, '[redacted-email]')
  assert.equal(JSON.stringify(detail.payload.data.inputSummary).includes('buyer@example.com'), false)
  assert.equal(detail.payload.data.aiTask.id, aiTaskId)

  const resultBeforeConfirm = await request(`/api/tool-calls/${toolCallId}/result`, { cookie: sales, method: 'POST', body: { confirmedHumanExecution: true, executionResult: { messageId: 'manual-1' } } })
  assert.equal(resultBeforeConfirm.response.status, 400)
  assert.equal(resultBeforeConfirm.payload.error.code, 'TOOL_CALL_NOT_CONFIRMED')

  const confirmMissing = await request(`/api/tool-calls/${toolCallId}/confirm`, { cookie: sales, method: 'POST', body: {} })
  assert.equal(confirmMissing.response.status, 400)
  assert.equal(confirmMissing.payload.error.code, 'HUMAN_CONFIRMATION_REQUIRED')

  const financeConfirmDenied = await request(`/api/tool-calls/${toolCallId}/confirm`, { cookie: finance, method: 'POST', body: { confirmedHumanReview: true } })
  assert.equal(financeConfirmDenied.response.status, 403)

  const confirmed = await request(`/api/tool-calls/${toolCallId}/confirm`, { cookie: manager, method: 'POST', body: { confirmedHumanReview: true } })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.data.status, 'CONFIRMED')
  assert.ok(confirmed.payload.data.confirmedById)

  const resultMissingHuman = await request(`/api/tool-calls/${toolCallId}/result`, { cookie: sales, method: 'POST', body: { executionResult: { messageId: 'manual-2' } } })
  assert.equal(resultMissingHuman.response.status, 400)
  assert.equal(resultMissingHuman.payload.error.code, 'HUMAN_EXECUTION_REQUIRED')

  const result = await request(`/api/tool-calls/${toolCallId}/result`, { cookie: sales, method: 'POST', body: { confirmedHumanExecution: true, status: 'EXECUTION_RECORDED', executionResult: { channel: 'email', messageId: 'manual-send-001', note: '人工在外部邮箱发送后回填' }, externalRequestId: 'manual-send-001' } })
  assert.equal(result.response.status, 200)
  assert.equal(result.payload.data.status, 'EXECUTION_RECORDED')
  assert.equal(result.payload.data.executionResult.messageId, 'manual-send-001')

  const failedDraft = await request('/api/tool-calls', { cookie: sales, method: 'POST', body: { module: 'communication', toolName: 'social_connector', action: 'publish_post', riskLevel: 'critical', input: { platform: 'linkedin', draftOnly: true } } })
  assert.equal(failedDraft.response.status, 201)
  const failedConfirm = await request(`/api/tool-calls/${failedDraft.payload.data.id}/confirm`, { cookie: sales, method: 'POST', body: { confirmedHumanReview: true } })
  assert.equal(failedConfirm.response.status, 200)
  const failedResult = await request(`/api/tool-calls/${failedDraft.payload.data.id}/result`, { cookie: sales, method: 'POST', body: { confirmedHumanExecution: true, status: 'FAILED', errorMessage: '连接器不可用，降级为人工发布任务。' } })
  assert.equal(failedResult.response.status, 200)
  assert.equal(failedResult.payload.data.status, 'FAILED')

  const state = testMemoryState()
  assert.equal(state.aiTasks.length, 1)
  assert.equal(state.toolCalls.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'tool_call').length, 6)

  console.log(JSON.stringify({ result: 'passed', aiTasks: state.aiTasks.length, toolCalls: state.toolCalls.length, finalStatus: result.payload.data.status, failedStatus: failedResult.payload.data.status }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
