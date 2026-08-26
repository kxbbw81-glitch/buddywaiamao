import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p3-ops-status-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

try {
  const admin = await login('admin@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const denied = await request('/api/admin/ops/status', { cookie: sales })
  assert.equal(denied.response.status, 403)
  const status = await request('/api/admin/ops/status', { cookie: admin })
  assert.equal(status.response.status, 200)
  assert.equal(status.payload.data.database.reachable, true)
  assert.equal(status.payload.data.database.mode, 'memory-test')
  assert.equal(status.payload.data.backup.automatedExecution, false)
  assert.equal(typeof status.payload.data.process.rssMiB, 'number')
  assert.equal(typeof status.payload.data.queue.backend, 'string')
  assert.doesNotMatch(JSON.stringify(status.payload), /DATABASE_URL|SESSION_SECRET|passwordHash/i)
  console.log(JSON.stringify({ result: 'passed', mode: 'p3-admin-ops-status', admin: status.response.status, salesDenied: denied.response.status, queue: status.payload.data.queue.backend, backupMode: status.payload.data.backup.mode }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
