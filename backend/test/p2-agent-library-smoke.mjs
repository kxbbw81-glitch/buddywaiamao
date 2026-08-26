import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-agent-library-smoke-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const payload = await response.json()
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.cookie)
  return result.cookie
}

try {
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')

  const skills = await request('/api/agent-library/skills?pageSize=20', { cookie: sales })
  assert.equal(skills.response.status, 200)
  assert.equal(skills.payload.data.total, 6)
  assert.equal(skills.payload.data.items[0].instructions, undefined)
  assert.equal(skills.payload.data.items[0].executionMode, 'GUIDED_EXISTING_API_ONLY')

  const skillDetail = await request('/api/agent-library/skills/prospecting', { cookie: sales })
  assert.equal(skillDetail.response.status, 200)
  assert.match(skillDetail.payload.data.instructions, /自动获客|搜客/)

  const match = await request('/api/agent-library/skills/match', { cookie: sales, method: 'POST', body: { goal: '帮我搜索采购商并整理候选线索', activeModule: 'lead-finder' } })
  assert.equal(match.response.status, 200)
  assert.ok(match.payload.data.matches.some((item) => item.skill.id === 'prospecting'))
  assert.equal(match.payload.data.executionMode, 'GUIDED_EXISTING_API_ONLY')

  const knowledge = await request('/api/agent-library/knowledge?pageSize=20', { cookie: sales })
  assert.equal(knowledge.response.status, 200)
  assert.equal(knowledge.payload.data.total, 10)
  assert.equal(knowledge.payload.data.items[0].content, undefined)

  const knowledgeDetail = await request('/api/agent-library/knowledge/workflow.development-email.v1', { cookie: sales })
  assert.equal(knowledgeDetail.response.status, 200)
  assert.match(knowledgeDetail.payload.data.content, /真实发送必须冻结/)

  const searched = await request('/api/agent-library/knowledge/search', { cookie: sales, method: 'POST', body: { query: '开发信只写草稿不要发送', activeModule: 'development-email' } })
  assert.equal(searched.response.status, 200)
  assert.equal(searched.payload.data.status, 'ANSWERED_WITH_SOURCES')
  assert.ok(searched.payload.data.sources.some((item) => item.id === 'workflow.development-email.v1'))

  const invalidPage = await request('/api/agent-library/skills?pageSize=101', { cookie: sales })
  assert.equal(invalidPage.response.status, 400)
  const denied = await request('/api/agent-library/skills', { cookie: finance })
  assert.equal(denied.response.status, 403)
  const tooLarge = await request('/api/agent-library/skills/match', { cookie: sales, method: 'POST', body: { goal: 'x'.repeat(1001) } })
  assert.equal(tooLarge.response.status, 400)

  console.log(JSON.stringify({ result: 'passed', skills: skills.payload.data.total, knowledge: knowledge.payload.data.total, match: 'prospecting', search: searched.payload.data.status, financeDenied: denied.response.status }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
