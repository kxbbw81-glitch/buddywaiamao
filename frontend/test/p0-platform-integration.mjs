import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'

const root = new URL('../../', import.meta.url)
const backendDir = new URL('backend/', root)
const frontendDir = new URL('frontend/', root)

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
  child.log = () => log.slice(-4000)
  return child
}

async function waitFor(url, attempts = 80) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url)
      if (response.status < 500) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
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

const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], {
  cwd: backendDir,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    NEXFAB_MEMORY_TEST_DB: 'true',
    SESSION_SECRET: 'p0-platform-integration-secret-0123456789abcdef',
    PORT: String(backendPort),
  },
})
let frontend

try {
  await waitFor(`http://127.0.0.1:${backendPort}/health`)
  frontend = start('npx', ['next', 'start', '--hostname', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: frontendDir,
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}` },
  })
  const appBase = `http://127.0.0.1:${frontendPort}`
  await waitFor(appBase)

  const unauth = await request(appBase, '/api/backend/api/auth/session')
  assert.equal(unauth.response.status, 401)
  assert.equal(unauth.payload.error.code, 'UNAUTHENTICATED')

  const roles = [
    ['sales@nexfab.test', 'SALES'],
    ['manager@nexfab.test', 'MANAGER'],
    ['finance@nexfab.test', 'FINANCE'],
    ['exec@nexfab.test', 'EXEC'],
    ['admin@nexfab.test', 'ADMIN'],
  ]
  const roleEvidence = []
  for (const [email, role] of roles) {
    const login = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
    assert.equal(login.response.status, 200)
    assert.equal(login.payload.data.user.role, role)
    assert.equal(login.payload.data.user.passwordHash, undefined)
    assert.ok(login.cookie)

    const session = await request(appBase, '/api/backend/api/auth/session', { cookie: login.cookie })
    assert.equal(session.response.status, 200)
    assert.equal(session.payload.data.user.role, role)
    assert.equal(session.payload.data.user.passwordHash, undefined)

    const nav = await request(appBase, '/api/backend/api/navigation', { cookie: login.cookie })
    assert.equal(nav.response.status, 200)
    assert.ok(nav.payload.data.modules.length > 0)

    const dashboard = await request(appBase, '/api/backend/api/dashboard', { cookie: login.cookie })
    assert.equal(dashboard.response.status, 200)
    assert.equal(dashboard.payload.data.noExternalSideEffects, true)

    roleEvidence.push({ role, modules: nav.payload.data.modules.length, subs: nav.payload.data.modules.reduce((sum, item) => sum + item.subs.length, 0), metrics: dashboard.payload.data.metrics.length })
  }

  const finance = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email: 'finance@nexfab.test', password: 'TestOnly#Password1' } })
  const financeCrm = await request(appBase, '/api/backend/api/customers', { cookie: finance.cookie })
  assert.equal(financeCrm.response.status, 403)

  const manager = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email: 'manager@nexfab.test', password: 'TestOnly#Password1' } })
  const badDashboard = await request(appBase, '/api/backend/api/dashboard?range=year', { cookie: manager.cookie })
  assert.equal(badDashboard.response.status, 400)

  const admin = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email: 'admin@nexfab.test', password: 'TestOnly#Password1' } })
  const customer = await request(appBase, '/api/backend/api/customers', { cookie: admin.cookie, method: 'POST', body: { name: 'P0 越权测试客户' } })
  assert.equal(customer.response.status, 201)
  const sales = await request(appBase, '/api/backend/api/auth/login', { method: 'POST', body: { email: 'sales@nexfab.test', password: 'TestOnly#Password1' } })
  const salesOverreach = await request(appBase, `/api/backend/api/customers/${customer.payload.data.id}`, { cookie: sales.cookie })
  assert.equal(salesOverreach.response.status, 403)

  console.log(JSON.stringify({ result: 'passed', mode: 'p0-platform-integration', unauth: 401, roles: roleEvidence, financeCrm: 403, invalidDashboardRange: 400, salesOverreach: 403 }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  if (frontend) frontend.kill('SIGTERM')
  backend.kill('SIGTERM')
}
