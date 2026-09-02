import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p0-login-smoke-session-secret-0123456789abcdef'
delete process.env.NEXFAB_ADMIN_LOGIN_EMAIL

const { createAppServer } = await import('../src/server.mjs')
const { findUserForLogin } = await import('../src/auth-login.mjs')

const frontendLogin = readFileSync(new URL('../../frontend/src/components/login-form.tsx', import.meta.url), 'utf8')
assert.ok(frontendLogin.includes('账号 / 邮箱'))
assert.ok(frontendLogin.includes("type=\"text\""))
assert.ok(!frontendLogin.includes("type=\"email\""))
assert.ok(frontendLogin.includes("['admin', '默认管理员']"))

const ambiguousDb = {
  user: {
    findMany: async () => [
      { id: 'admin-1', email: 'one@example.test', role: 'ADMIN', status: 'ACTIVE', passwordHash: 'x:y' },
      { id: 'admin-2', email: 'two@example.test', role: 'ADMIN', status: 'ACTIVE', passwordHash: 'x:y' },
    ],
  },
}
await assert.rejects(() => findUserForLogin(ambiguousDb, 'admin', {}), /存在多个启用管理员/)

const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  return { response, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

try {
  const emailLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@nexfab.test', password: 'TestOnly#Password1' } })
  assert.equal(emailLogin.response.status, 200)
  assert.ok(emailLogin.cookie)
  assert.equal(emailLogin.payload.data.user.role, 'ADMIN')

  const aliasLogin = await request('/api/auth/login', { method: 'POST', body: { loginId: 'admin', password: 'TestOnly#Password1' } })
  assert.equal(aliasLogin.response.status, 200)
  assert.ok(aliasLogin.cookie)
  assert.equal(aliasLogin.payload.data.user.email, 'admin@nexfab.test')
  assert.equal(aliasLogin.payload.data.user.role, 'ADMIN')
  assert.equal(JSON.stringify(aliasLogin.payload).includes('passwordHash'), false)

  const accountLogin = await request('/api/auth/login', { method: 'POST', body: { account: 'sales@nexfab.test', password: 'TestOnly#Password1' } })
  assert.equal(accountLogin.response.status, 200)
  assert.equal(accountLogin.payload.data.user.role, 'SALES')

  const session = await request('/api/auth/session', { cookie: aliasLogin.cookie })
  assert.equal(session.response.status, 200)
  assert.equal(session.payload.data.user.role, 'ADMIN')

  const invalid = await request('/api/auth/login', { method: 'POST', body: { loginId: 'unknown-user', password: 'TestOnly#Password1' } })
  assert.equal(invalid.response.status, 401)
  assert.equal(invalid.payload.error.code, 'INVALID_CREDENTIALS')

  console.log(JSON.stringify({ result: 'passed', mode: 'login-alias-and-email', emailLogin: emailLogin.response.status, adminAliasLogin: aliasLogin.response.status, accountLogin: accountLogin.response.status, session: session.response.status, ambiguousAlias: 409 }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
