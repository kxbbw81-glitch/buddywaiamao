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
  if (existsSync(new URL('.next/BUILD_ID', frontendDir))) return
  const result = spawnSync(process.execPath, [nextBin, 'build'], { cwd: frontendDirPath, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`next build failed before integration test:\n${result.stdout}\n${result.stderr}`)
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
    } catch (error) { lastError = error }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

async function request(base, path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(base, email) {
  const result = await request(base, '/api/backend/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.cookie)
  return result.cookie
}

const componentSource = readFileSync(new URL('../src/components/p1-import-dashboard-view.tsx', import.meta.url), 'utf8')
for (const expected of ['下载空白 CSV 模板', 'CSV / Excel', 'dryRun 预览', '确认正式导入', 'conflicts / skipped', '基础经营看板', '数据范围：', "import('xlsx')"]) {
  assert.ok(componentSource.includes(expected), `P1.4 UI missing: ${expected}`)
}
for (const disallowed of ['Brazil Retail Group', 'P14-001', 'p14-lead@example.test']) {
  assert.equal(componentSource.includes(disallowed), false, `P1.4 UI must not embed business sample data: ${disallowed}`)
}
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
for (const expected of ["importTemplates: () => apiFetch<ImportTemplateList>('/api/import/templates')", 'importTemplate: (type: string)', "`/api/import/${encodeURIComponent(type)}`", "dashboard: (range = 'today')"]) {
  assert.ok(apiSource.includes(expected), `P1.4 same-origin API helper missing: ${expected}`)
}

const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], {
  cwd: backendDirPath,
  env: { ...process.env, NODE_ENV: 'test', NEXFAB_MEMORY_TEST_DB: 'true', SESSION_SECRET: 'p1-import-dashboard-secret-0123456789abcdef', PORT: String(backendPort) },
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

  const sales = await login(appBase, 'sales@nexfab.test')
  const manager = await login(appBase, 'manager@nexfab.test')
  const finance = await login(appBase, 'finance@nexfab.test')

  const templates = await request(appBase, '/api/backend/api/import/templates', { cookie: sales })
  assert.equal(templates.response.status, 200)
  assert.ok(templates.payload.data.items.length >= 2)
  assert.ok(templates.payload.data.items.every((item) => item.noBusinessSampleData === true && item.csvHeader && item.columns.length > 0))
  const leadTemplate = await request(appBase, '/api/backend/api/import/templates/leads', { cookie: sales })
  assert.equal(leadTemplate.response.status, 200)
  assert.equal(leadTemplate.payload.data.noBusinessSampleData, true)
  assert.equal(leadTemplate.payload.data.csvHeader.includes('companyName'), true)

  const rows = [{ source: 'CSV', companyName: 'Integration Import Customer', contactName: 'Integration Contact', email: 'integration-import@example.test' }]
  const dryRun = await request(appBase, '/api/backend/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: true, rows } })
  assert.equal(dryRun.response.status, 200)
  assert.equal(dryRun.payload.data.dryRun, true)
  assert.equal(dryRun.payload.data.created[0].preview, true)
  const unconfirmed = await request(appBase, '/api/backend/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: false, rows } })
  assert.equal(unconfirmed.response.status, 400)
  assert.equal(unconfirmed.payload.error.code, 'CONFIRM_IMPORT_REQUIRED')
  const confirmed = await request(appBase, '/api/backend/api/import/leads', { cookie: sales, method: 'POST', body: { dryRun: false, confirmImport: true, rows } })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.payload.data.dryRun, false)
  assert.equal(confirmed.payload.data.summary.created, 1)

  const salesDashboard = await request(appBase, '/api/backend/api/dashboard?range=30d', { cookie: sales })
  assert.equal(salesDashboard.response.status, 200)
  assert.equal(salesDashboard.payload.data.role, 'SALES')
  assert.equal(salesDashboard.payload.data.business.mode, 'CURRENT_CUMULATIVE_OVERVIEW')
  assert.equal(salesDashboard.payload.data.business.rangeLabel, '当前累计概览')
  assert.ok(salesDashboard.payload.data.business.funnel.some((item) => item.id === 'leadsTotal' && item.value >= 1))
  assert.equal(salesDashboard.payload.data.metrics.find((item) => item.id === 'pendingQuoteApprovals').scope, 'requested-by-me')

  const managerDashboard = await request(appBase, '/api/backend/api/dashboard?range=30d', { cookie: manager })
  assert.equal(managerDashboard.response.status, 200)
  assert.equal(managerDashboard.payload.data.role, 'MANAGER')
  assert.equal(managerDashboard.payload.data.metrics.find((item) => item.id === 'pendingQuoteApprovals').scope, 'role-queue')
  assert.ok(managerDashboard.payload.data.business.risks.some((item) => item.id === 'registeredPayments'))

  const financeImportDenied = await request(appBase, '/api/backend/api/import/leads', { cookie: finance, method: 'POST', body: { dryRun: true, rows } })
  assert.equal(financeImportDenied.response.status, 403)

  console.log(JSON.stringify({ result: 'passed', mode: 'p1-import-dashboard-frontend', templates: templates.payload.data.items.length, dryRun: true, confirmImport: true, dashboard: { sales: salesDashboard.payload.data.role, manager: managerDashboard.payload.data.role, range: salesDashboard.payload.data.business.rangeLabel }, financeLeadImport: 403 }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  await stopProcess(frontend)
  await stopProcess(backend)
}
