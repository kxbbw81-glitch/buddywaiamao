import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { once } from 'node:events'

if (process.env.NEXFAB_P3_PERF_LOCAL !== 'true') throw new Error('NEXFAB_P3_PERF_LOCAL=true is required; this benchmark only targets a dedicated local test database.')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the local performance benchmark.')
const target = new URL(process.env.DATABASE_URL)
const database = target.pathname.replace(/^\//, '')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !/^nexfab_(p2_verify|p3_perf)/.test(database)) {
  throw new Error('Refusing performance benchmark outside a dedicated local nexfab_p2_verify or nexfab_p3_perf database.')
}

process.env.NODE_ENV = 'test'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p3-performance-local-session-secret-0123456789abcdef'
const { createAppServer } = await import('../src/server.mjs')
const { prisma } = await import('../src/prisma.mjs')
const db = await prisma()
const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`
const p95LimitMs = Number(process.env.NEXFAB_P3_LOCAL_P95_MAX_MS || 1000)
if (!Number.isFinite(p95LimitMs) || p95LimitMs <= 0) throw new Error('NEXFAB_P3_LOCAL_P95_MAX_MS 必须为正数。')

function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right)
  return Number(sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)].toFixed(1))
}

async function request(base, path, cookie) {
  const started = performance.now()
  const response = await fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : undefined })
  const elapsed = performance.now() - started
  const text = await response.text()
  return { response, elapsed, payload: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

const admin = await db.user.create({ data: { email: `perf-${suffix}@nexfab.test`, name: 'P3 性能管理员', passwordHash: passwordHash('TestOnly#Password1'), role: 'ADMIN' } })
await db.customer.createMany({ data: Array.from({ length: 300 }, (_, index) => ({ name: `P3 PERF ${suffix} ${index}`, country: 'CN', ownerId: admin.id })) })
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

try {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: admin.email, password: 'TestOnly#Password1' }) })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie)
  const endpoints = ['/api/navigation', '/api/dashboard?range=today', '/api/admin/ops/status']
  const results = {}
  for (const endpoint of endpoints) {
    for (let warmup = 0; warmup < 3; warmup += 1) assert.equal((await request(base, endpoint, cookie)).response.status, 200)
    const timings = []
    for (let sample = 0; sample < 30; sample += 1) {
      const result = await request(base, endpoint, cookie)
      assert.equal(result.response.status, 200)
      timings.push(result.elapsed)
    }
    const p95 = percentile(timings, 0.95)
    assert.ok(p95 <= p95LimitMs, `${endpoint} local P95 ${p95}ms exceeds ${p95LimitMs}ms`)
    results[endpoint] = { samples: timings.length, p50Ms: percentile(timings, 0.5), p95Ms: p95 }
  }
  console.log(JSON.stringify({ result: 'passed', mode: 'p3-local-performance-baseline', database: 'dedicated-local', customerFixtureCount: 300, p95LimitMs, endpoints: results, note: 'local baseline only; not production P95 evidence' }))
} finally {
  await new Promise((resolve) => server.close(resolve))
  await db.$disconnect()
}
