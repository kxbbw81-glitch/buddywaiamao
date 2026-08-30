import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
// 修复说明：[低危-可移植性]，原因：经 PATH 找到的 npx 其 shebang 指向固定 node 路径，换机即 ENOENT；改用当前 node 直调 next bin。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'

const root = new URL('../../', import.meta.url)
// 修复说明：[低危-可移植性]，原因：backendDir 硬编码 monorepo 兄弟目录布局，独立副本即 spawn ENOENT；支持 NEXFAB_BACKEND_DIR 覆盖。
const backendDir = process.env.NEXFAB_BACKEND_DIR ? new URL(`file://${process.env.NEXFAB_BACKEND_DIR}/`) : new URL('backend/', root)
// 修复说明：[低危-可移植性]，原因：frontendDir 原按 monorepo 布局指向兄弟目录，独立副本下不存在导致 build/spawn 全部 ENOENT；改为相对测试文件自身解析（两种布局均正确）。
const frontendDir = new URL('../', import.meta.url)
// 修复说明：[低危-可移植性]，原因：child_process 的 cwd 不接受 URL 对象（字符串化后路径非法即 ENOENT）；统一转文件路径。
const backendDirPath = new URL('file://').protocol === 'file:' ? (await import('node:url')).fileURLToPath(backendDir) : backendDir
const frontendDirPath = (await import('node:url')).fileURLToPath(frontendDir)

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
  const result = spawnSync(process.execPath, [nextBin, 'build'], { cwd: frontendDirPath, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`next build failed before P2.1 integration test:\n${result.stdout}\n${result.stderr}`)
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
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(base, email) {
  const result = await request(base, '/api/backend/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.cookie)
  return result.cookie
}

async function readSseUntilTerminal(base, path, cookie) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie }, signal: controller.signal })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type')?.startsWith('text/event-stream'), true)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      if (text.includes('"terminal":true')) break
    }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
  return text
}

const componentSource = readFileSync(new URL('../src/components/p2-ai-workbench-view.tsx', import.meta.url), 'utf8')
const agentLibrarySource = readFileSync(new URL('../src/components/agent-library-view.tsx', import.meta.url), 'utf8')
for (const expected of ['RAG 资料问答与引用', '拒绝无依据回答', 'AiTask 审计：token、成本、时长与数据出境', 'ToolCall：仅登记、人工确认、外部人工执行', '不会自动执行', '人工已复核，写入确认', '异步任务队列与 SSE 状态', '创建异步本地草稿并监听 SSE']) {
  assert.ok(componentSource.includes(expected), `P2.1 UI missing guardrail: ${expected}`)
}
for (const prohibited of ['自动定价', '自动审批', '自动发送', '自动执行']) {
  assert.ok(componentSource.includes(prohibited), `P2.1 UI must explicitly prohibit: ${prohibited}`)
}
for (const expected of ['api.ragQuery', 'api.aiGatewayStatus', 'api.aiCapabilityContracts', 'api.aiTasks', 'api.toolCalls', 'api.createToolCall', 'api.confirmToolCall', 'new EventSource', 'api.runAiGateway({ async: true', 'api.aiTask(taskId)', 'polling_fallback', 'queue backend', 'SSE 状态', 'SSE 失败时前端会退回 AiTask 轮询']) {
  assert.ok(componentSource.includes(expected), `P2 AI workbench missing async/SSE contract: ${expected}`)
}
for (const expected of ['自定义 Skills', '目标匹配诊断', 'Agent 学习中心', '资料问答', 'api.matchAgentSkills', 'api.searchAgentKnowledge', '该库不自动执行写入、发送或外部调用', '打开对应 V2.0 页面', 'prospecting']) {
  assert.ok(agentLibrarySource.includes(expected), `Agent library UI missing contract: ${expected}`)
}

const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], {
  cwd: backendDirPath,
  env: { ...process.env, NODE_ENV: 'test', NEXFAB_MEMORY_TEST_DB: 'true', SESSION_SECRET: 'p2-ai-workbench-secret-0123456789abcdef', PORT: String(backendPort) },
})
let frontend

try {
  await waitFor(`http://127.0.0.1:${backendPort}/health`)
  ensureFrontendBuild()
  frontend = start(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: frontendDirPath,
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}`, NEXT_TELEMETRY_DISABLED: '1' },
  })
  const appBase = `http://127.0.0.1:${frontendPort}`
  await waitFor(appBase)

  const manager = await login(appBase, 'manager@nexfab.test')
  const admin = await login(appBase, 'admin@nexfab.test')
  const sales = await login(appBase, 'sales@nexfab.test')
  const finance = await login(appBase, 'finance@nexfab.test')

  const agentSkills = await request(appBase, '/api/backend/api/agent-library/skills?pageSize=20', { cookie: sales })
  assert.equal(agentSkills.response.status, 200)
  assert.equal(agentSkills.payload.data.total, 6)
  assert.equal(agentSkills.payload.data.items[0].instructions, undefined)
  const skillMatch = await request(appBase, '/api/backend/api/agent-library/skills/match', { cookie: sales, method: 'POST', body: { goal: '搜索采购商并整理候选线索', activeModule: 'lead-finder' } })
  assert.equal(skillMatch.response.status, 200)
  assert.ok(skillMatch.payload.data.matches.some((item) => item.skill.id === 'prospecting'))
  const agentKnowledge = await request(appBase, '/api/backend/api/agent-library/knowledge?pageSize=20', { cookie: sales })
  assert.equal(agentKnowledge.response.status, 200)
  assert.equal(agentKnowledge.payload.data.total, 10)
  assert.equal(agentKnowledge.payload.data.items[0].content, undefined)
  const knowledgeSearch = await request(appBase, '/api/backend/api/agent-library/knowledge/search', { cookie: sales, method: 'POST', body: { query: '开发信只写草稿不要发送', activeModule: 'development-email' } })
  assert.equal(knowledgeSearch.response.status, 200)
  assert.equal(knowledgeSearch.payload.data.status, 'ANSWERED_WITH_SOURCES')
  const financeAgentLibraryDenied = await request(appBase, '/api/backend/api/agent-library/skills', { cookie: finance })
  assert.equal(financeAgentLibraryDenied.response.status, 403)

  const status = await request(appBase, '/api/backend/api/ai-gateway/status', { cookie: sales })
  assert.equal(status.response.status, 200)
  assert.equal(status.payload.data.secretsExposed, false)
  assert.equal(status.payload.data.policy.humanConfirmationRequired, true)
  assert.equal(status.payload.data.policy.sseStatusStream, true)
  assert.ok(status.payload.data.queue)
  const queueStatus = await request(appBase, '/api/backend/api/ai-queue/status', { cookie: sales })
  assert.equal(queueStatus.response.status, 200)
  assert.ok(['memory', 'bullmq-redis'].includes(queueStatus.payload.data.backend))

  const asyncRun = await request(appBase, '/api/backend/api/ai-gateway/run', {
    cookie: sales,
    method: 'POST',
    body: { async: true, module: 'AI_AGENT', purpose: 'P2.2 前端 SSE 代理验收', input: { request: '只生成本地草稿；不得执行外部动作。' } },
  })
  assert.equal(asyncRun.response.status, 202)
  assert.equal(asyncRun.payload.data.task.status, 'QUEUED')
  assert.ok(asyncRun.payload.data.eventsUrl)
  const sseText = await readSseUntilTerminal(appBase, `/api/backend${asyncRun.payload.data.eventsUrl}`, sales)
  assert.ok(sseText.includes('QUEUED'))
  assert.ok(sseText.includes('SUCCEEDED'))
  assert.ok(!sseText.includes('不得执行外部动作'))

  const financeRagDenied = await request(appBase, '/api/backend/api/rag/query', { cookie: finance, method: 'POST', body: { query: '权限测试' } })
  assert.equal(financeRagDenied.response.status, 403)
  const financeToolDenied = await request(appBase, '/api/backend/api/tool-calls', { cookie: finance, method: 'POST', body: { module: 'AI_AGENT', toolName: 'MANUAL', action: 'REVIEW' } })
  assert.equal(financeToolDenied.response.status, 403)

  const category = await request(appBase, '/api/backend/api/product-categories', { cookie: manager, method: 'POST', body: { name: 'P2.1 RAG Category' } })
  assert.equal(category.response.status, 201)
  const product = await request(appBase, '/api/backend/api/products', { cookie: manager, method: 'POST', body: { sku: 'P21-RAG-001', name: 'P2.1 RAG Product', categoryId: category.payload.data.id, specs: { type: 'p21' }, packing: { unit: 'box' }, costVersions: { current: 1 } } })
  assert.equal(product.response.status, 201)
  const document = await request(appBase, '/api/backend/api/knowledge-documents', {
    cookie: manager,
    method: 'POST',
    body: { title: 'P2.1 RAG Source', type: 'FAQ', sourceName: 'p21-rag-source.md', version: 'v1', productId: product.payload.data.id, chunks: [{ heading: 'Approved source', content: 'P21 approved source says inspection is required before the operator may issue any commitment.' }] },
  })
  assert.equal(document.response.status, 201)
  // 修复说明：[中危-口径同步] 知识文档审核禁止自审；测试改由 ADMIN 审核。
  const approved = await request(appBase, `/api/backend/api/knowledge-documents/${document.payload.data.id}/review`, { cookie: admin, method: 'POST', body: { status: 'APPROVED', note: 'reviewed' } })
  assert.equal(approved.response.status, 200)

  const cited = await request(appBase, '/api/backend/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'inspection required', productId: product.payload.data.id, module: 'AI_AGENT' } })
  assert.equal(cited.response.status, 200)
  assert.equal(cited.payload.data.status, 'ANSWERED_WITH_SOURCES')
  assert.equal(cited.payload.data.sources.length, 1)
  assert.equal(cited.payload.data.sources[0].fileName, 'p21-rag-source.md')
  assert.ok(cited.payload.data.aiTaskId)

  const refused = await request(appBase, '/api/backend/api/rag/query', { cookie: sales, method: 'POST', body: { query: 'qzvoidonly', module: 'AI_AGENT' } })
  assert.equal(refused.response.status, 200)
  assert.equal(refused.payload.data.status, 'INSUFFICIENT_CONTEXT')
  assert.deepEqual(refused.payload.data.sources, [])
  assert.match(refused.payload.data.answer, /暂未找到|不知道/)

  const task = await request(appBase, `/api/backend/api/ai-tasks/${cited.payload.data.aiTaskId}`, { cookie: sales })
  assert.equal(task.response.status, 200)
  assert.equal(task.payload.data.dataSentToCloud, false)
  assert.equal(task.payload.data.tokens, 0)
  assert.equal(task.payload.data.cost, '0')
  assert.equal(typeof task.payload.data.durationMs, 'number')
  assert.equal(task.payload.data._count.citations, 1)

  const noConfirm = await request(appBase, '/api/backend/api/tool-calls', { cookie: sales, method: 'POST', body: { module: 'AI_AGENT', toolName: 'MANUAL_CONNECTOR', action: 'DRAFT', requiresHumanConfirmation: false } })
  assert.equal(noConfirm.response.status, 400)
  assert.equal(noConfirm.payload.error.code, 'HUMAN_CONFIRMATION_REQUIRED')
  const registered = await request(appBase, '/api/backend/api/tool-calls', { cookie: sales, method: 'POST', body: { aiTaskId: cited.payload.data.aiTaskId, module: 'AI_AGENT', toolName: 'MANUAL_CONNECTOR', action: 'DRAFT', riskLevel: 'HIGH', inputSummary: { operatorSummary: 'manual only' }, requiresHumanConfirmation: true } })
  assert.equal(registered.response.status, 201)
  assert.equal(registered.payload.data.status, 'PENDING_CONFIRMATION')
  assert.equal(registered.payload.data.requiresHumanConfirmation, true)
  const resultBeforeConfirm = await request(appBase, `/api/backend/api/tool-calls/${registered.payload.data.id}/result`, { cookie: sales, method: 'POST', body: { confirmedHumanExecution: true, executionResult: { result: 'must not run' } } })
  assert.equal(resultBeforeConfirm.response.status, 400)
  assert.equal(resultBeforeConfirm.payload.error.code, 'TOOL_CALL_NOT_CONFIRMED')
  const confirmed = await request(appBase, `/api/backend/api/tool-calls/${registered.payload.data.id}/confirm`, { cookie: manager, method: 'POST', body: { confirmedHumanReview: true } })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.data.status, 'CONFIRMED')
  assert.ok(confirmed.payload.data.confirmedById)

  console.log(JSON.stringify({ result: 'passed', mode: 'p2-ai-workbench-frontend', agentLibrary: { skills: agentSkills.payload.data.total, knowledge: agentKnowledge.payload.data.total, match: 'prospecting', search: knowledgeSearch.payload.data.status, financeDenied: financeAgentLibraryDenied.response.status }, ragSources: cited.payload.data.sources.length, refusedStatus: refused.payload.data.status, aiAudit: { tokens: task.payload.data.tokens, cost: task.payload.data.cost, durationMs: task.payload.data.durationMs, dataSentToCloud: task.payload.data.dataSentToCloud }, denied: { financeRag: 403, financeTool: 403, missingConfirmation: 400, executionBeforeConfirm: 400 }, toolCallStatus: confirmed.payload.data.status }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  await stopProcess(frontend)
  await stopProcess(backend)
}
