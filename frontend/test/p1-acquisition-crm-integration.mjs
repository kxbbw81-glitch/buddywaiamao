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
  child.log = () => log.slice(-5000)
  return child
}

function ensureFrontendBuild() {
  const buildId = new URL('.next/BUILD_ID', frontendDir)
  if (existsSync(buildId)) return
  const result = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: frontendDirPath,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`next build failed before integration test:
${result.stdout}
${result.stderr}`)
  }
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
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

const componentSource = readFileSync(new URL('../src/components/p1-acquisition-crm-view.tsx', import.meta.url), 'utf8')
for (const expected of ['创建线索', '登记询盘', '客户指纹查重', '线索转客户', '写入跟进记录']) {
  assert.ok(componentSource.includes(expected), `P1.1 UI missing label: ${expected}`)
}
assert.equal(componentSource.includes('Brazil Retail Group'), false, 'P1.1 production form must not embed a fixed customer sample')
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
for (const expected of ['/api/leads', '/api/inquiries', '/api/customers', '/api/opportunities', '/api/tools/dedupe']) {
  assert.ok(apiSource.includes(expected), `P1.1 API client missing endpoint: ${expected}`)
}

const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], {
  cwd: backendDirPath,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    NEXFAB_MEMORY_TEST_DB: 'true',
    SESSION_SECRET: 'p1-acquisition-crm-secret-0123456789abcdef',
    PORT: String(backendPort),
  },
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

  const login = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email: 'sales@nexfab.test', password: 'TestOnly#Password1' } })
  assert.equal(login.response.status, 200)
  assert.ok(login.cookie)

  const nav = await request(appBase, '/api/backend/api/navigation', { cookie: login.cookie })
  assert.equal(nav.response.status, 200)
  assert.ok(nav.payload.data.modules.some((item) => item.id === 'acquisition'))
  assert.ok(nav.payload.data.modules.some((item) => item.id === 'customer'))

  const lead = await request(appBase, '/api/backend/api/leads', {
    cookie: login.cookie,
    method: 'POST',
    body: {
      source: 'website',
      channel: 'form',
      companyName: 'P1 Brazil Retail Group',
      contactName: 'Ana Silva',
      email: 'p1-ana@example.com',
      phone: '+55 11 9988-7766',
      country: 'BR',
      language: 'en',
      productInterest: { products: ['LED street light'], quantity: '5000' },
      priority: 'high',
    },
  })
  assert.equal(lead.response.status, 201)
  assert.equal(lead.payload.data.status, 'NEW')

  const inquiry = await request(appBase, '/api/backend/api/inquiries', {
    cookie: login.cookie,
    method: 'POST',
    body: {
      leadId: lead.payload.data.id,
      subject: 'P1 LED street light inquiry',
      content: 'Need 5000 LED street lights. Please quote FOB and DDP.',
      source: 'website',
      channel: 'form',
      requirements: { tradeTerms: ['DDP'], source: 'frontend-p1' },
      missingFields: { voltage: true, certification: true },
      items: [{ productName: 'LED street light', quantity: 5000, unit: 'pcs' }],
    },
  })
  assert.equal(inquiry.response.status, 201)

  const inquiryStatus = await request(appBase, `/api/backend/api/inquiries/${inquiry.payload.data.id}/status`, { cookie: login.cookie, method: 'POST', body: { status: 'quoting' } })
  assert.equal(inquiryStatus.response.status, 200)
  assert.equal(inquiryStatus.payload.data.status, 'QUOTING')

  const customer = await request(appBase, '/api/backend/api/customers', { cookie: login.cookie, method: 'POST', body: { name: 'P1 Brazil Existing Customer', country: 'BR' } })
  assert.equal(customer.response.status, 201)
  const contact = await request(appBase, `/api/backend/api/customers/${customer.payload.data.id}/contacts`, { cookie: login.cookie, method: 'POST', body: { name: 'Ana Silva', email: 'p1-contact@example.com', phone: '+55 11 9988-7766' } })
  assert.equal(contact.response.status, 201)

  const dedupe = await request(appBase, '/api/backend/api/tools/dedupe', { cookie: login.cookie, method: 'POST', body: { companyName: 'P1 Brazil Existing Customer', email: 'p1-contact@example.com' } })
  assert.equal(dedupe.response.status, 200)
  assert.equal(dedupe.payload.data.hasDuplicates, true)

  const converted = await request(appBase, `/api/backend/api/leads/${lead.payload.data.id}/convert`, { cookie: login.cookie, method: 'POST', body: { duplicateCheckConfirmed: true, opportunityName: 'P1 Brazil LED Road Project', amount: 250000, currency: 'USD' } })
  assert.equal(converted.response.status, 200)
  assert.equal(converted.payload.data.lead.status, 'CONVERTED')
  assert.ok(converted.payload.data.customer.id)
  assert.ok(converted.payload.data.opportunity.id)

  const follow = await request(appBase, `/api/backend/api/opportunities/${converted.payload.data.opportunity.id}/follow-ups`, { cookie: login.cookie, method: 'POST', body: { type: 'email', content: '前端 P1.1 集成测试写入跟进。' } })
  assert.equal(follow.response.status, 201)

  const leadList = await request(appBase, '/api/backend/api/leads?pageSize=8', { cookie: login.cookie })
  assert.equal(leadList.response.status, 200)
  assert.ok(leadList.payload.data.items.some((item) => item.id === lead.payload.data.id && item.status === 'CONVERTED'))

  const finance = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email: 'finance@nexfab.test', password: 'TestOnly#Password1' } })
  const financeLeads = await request(appBase, '/api/backend/api/leads', { cookie: finance.cookie })
  assert.equal(financeLeads.response.status, 403)

  console.log(JSON.stringify({ result: 'passed', mode: 'p1-acquisition-crm-frontend', leadStatus: 'CONVERTED', inquiryStatus: 'QUOTING', dedupe: true, followUps: 1, financeLeads: 403 }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  await stopProcess(frontend)
  await stopProcess(backend)
}
