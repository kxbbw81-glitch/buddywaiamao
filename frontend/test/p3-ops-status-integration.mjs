import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
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
  child.log = () => log.slice(-5000)
  return child
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const done = once(child, 'exit').then(() => true)
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 5000))
  if (!(await Promise.race([done, timeout]))) { child.kill('SIGKILL'); await once(child, 'exit').catch(() => undefined) }
}

async function waitFor(url) {
  let last
  for (let i = 0; i < 120; i += 1) {
    try { const response = await fetch(url); if (response.status < 500) return response; last = new Error(`HTTP ${response.status}`) } catch (error) { last = error }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw last || new Error(`Timed out waiting for ${url}`)
}

async function request(base, path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(base, email) {
  const result = await request(base, '/api/backend/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

const component = readFileSync(new URL('../src/components/p3-ops-status-view.tsx', import.meta.url), 'utf8')
assert.match(component, /api\.opsStatus\(\)/)
assert.match(component, /不会执行迁移、备份、发布、连接器调用/)
const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], { cwd: backendDir, env: { ...process.env, NODE_ENV: 'test', NEXFAB_MEMORY_TEST_DB: 'true', SESSION_SECRET: 'p3-ops-status-frontend-0123456789abcdef', PORT: String(backendPort) } })
let frontend

try {
  await waitFor(`http://127.0.0.1:${backendPort}/health`)
  if (!existsSync(new URL('.next/BUILD_ID', frontendDir))) {
    const build = spawnSync('npx', ['next', 'build'], { cwd: frontendDir, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, encoding: 'utf8' })
    if (build.status !== 0) throw new Error(`frontend build failed:\n${build.stdout}\n${build.stderr}`)
  }
  frontend = start('npx', ['next', 'start', '--hostname', '127.0.0.1', '--port', String(frontendPort)], { cwd: frontendDir, env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}`, NEXT_TELEMETRY_DISABLED: '1' } })
  const appBase = `http://127.0.0.1:${frontendPort}`
  await waitFor(appBase)
  const admin = await login(appBase, 'admin@nexfab.test')
  const sales = await login(appBase, 'sales@nexfab.test')
  const adminStatus = await request(appBase, '/api/backend/api/admin/ops/status', { cookie: admin })
  assert.equal(adminStatus.response.status, 200)
  assert.equal(adminStatus.payload.data.database.reachable, true)
  assert.equal(adminStatus.payload.data.backup.automatedExecution, false)
  assert.doesNotMatch(JSON.stringify(adminStatus.payload), /DATABASE_URL|SESSION_SECRET|passwordHash/i)
  const denied = await request(appBase, '/api/backend/api/admin/ops/status', { cookie: sales })
  assert.equal(denied.response.status, 403)
  console.log(JSON.stringify({ result: 'passed', mode: 'p3-ops-status-frontend', admin: adminStatus.response.status, salesDenied: denied.response.status, database: adminStatus.payload.data.database.mode, backupAutomatic: adminStatus.payload.data.backup.automatedExecution }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  await stop(frontend)
  await stop(backend)
}
