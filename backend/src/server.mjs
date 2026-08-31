import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { navigationFor, ROLES } from './navigation.mjs'
import { notImplemented, plannedEndpoint } from './api-contract.mjs'
import { HttpError, readJson, send, text } from './http.mjs'
import { createSession, hashPassword, sessionCookie, sessionFromRequest, verifyPassword } from './security.mjs'
import { findUserForLogin } from './auth-login.mjs'
import { prisma } from './prisma.mjs'
import { handleCrmRoute } from './crm-routes.mjs'
import { handleCustomerProfileRoute } from './customer-profile-routes.mjs'
import { handleRetentionRoute } from './retention-routes.mjs'
import { handleProductRoute } from './product-routes.mjs'
import { handleQuoteRoute } from './quote-routes.mjs'
import { handleOrderRoute } from './order-routes.mjs'
import { handlePaymentRoute } from './payment-routes.mjs'
import { handleTimelineRoute } from './timeline-routes.mjs'
import { handleRagRoute } from './rag-routes.mjs'
import { handleSampleRoute } from './sample-routes.mjs'
import { handleTradeDocumentRoute } from './trade-document-routes.mjs'
import { handleFulfillmentRoute } from './fulfillment-routes.mjs'
import { handleCommissionRoute } from './commission-routes.mjs'
import { handleKnowledgeRoute } from './knowledge-routes.mjs'
import { handleAgentLibraryRoute } from './agent-library-routes.mjs'
import { handleAiGatewayRoute } from './ai-gateway-routes.mjs'
import { handleAutomationRoute } from './automation-routes.mjs'
import { handleIntegrationRoute } from './integration-routes.mjs'
import { handleDashboardRoute } from './dashboard-routes.mjs'
import { handleImportTemplateRoute } from './import-template-routes.mjs'
import { handleAcquisitionRoute } from './acquisition-routes.mjs'
import { handleToolsRoute } from './tools-routes.mjs'
import { handleOpsRoute } from './ops-routes.mjs'
import { handleSocialRoute } from './social-routes.mjs'
import { handleOutboundDraftRoute } from './outbound-draft-routes.mjs'
import { handleAnalyticsRoute } from './analytics-routes.mjs'
import { configurationStatus } from './config.mjs'

const port = Number(process.env.PORT || 8787)
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:4173'

function normalizeBasePath(url) {
  if (url.pathname === '/new') return '/'
  if (url.pathname.startsWith('/new/')) return url.pathname.slice('/new'.length) || '/'
  return url.pathname
}

async function authenticatedActor(session, db) {
  const user = await db.user.findUnique({ where: { id: session.sub }, select: { id: true, email: true, name: true, role: true, status: true, teamId: true, tokenVersion: true } })
  if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'UNAUTHENTICATED', '账号不存在或已停用。')
  if (user.role !== session.role) throw new HttpError(401, 'INVALID_SESSION', '会话角色已失效，请重新登录。')
  // 修复说明：[低危-会话安全]，原因：会话令牌无服务端撤销手段，登出/改密后旧 token 仍有效；现校验 tokenVersion，不匹配即失效。
  if ((user.tokenVersion ?? 0) !== (session.ver ?? 0)) throw new HttpError(401, 'INVALID_SESSION', '会话已失效，请重新登录。')
  return user
}

const previewFile = new URL('../../frontend-preview/index.html', import.meta.url)

// 修复说明：[中危-接口安全]，原因：登录接口原无任何防爆破限流，可无限次暴力猜测密码；现按账号+来源 IP 做失败计数，15 分钟窗口内失败 5 次即锁定 15 分钟。
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000
const LOGIN_LOCK_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILURES = 5
const loginFailures = new Map()

function loginAttemptKey(loginId, req) {
  return `${loginId}|${req.socket?.remoteAddress || 'unknown'}`
}

function assertLoginAllowed(key) {
  const entry = loginFailures.get(key)
  if (!entry) return
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    throw new HttpError(429, 'TOO_MANY_ATTEMPTS', '登录失败次数过多，请 15 分钟后再试。')
  }
  if (entry.resetAt && Date.now() > entry.resetAt) loginFailures.delete(key)
}

function recordLoginFailure(key) {
  if (loginFailures.size > 5000) {
    for (const staleKey of loginFailures.keys()) {
      loginFailures.delete(staleKey)
      if (loginFailures.size <= 5000) break
    }
  }
  const now = Date.now()
  const entry = loginFailures.get(key)
  if (!entry || now > entry.resetAt) {
    loginFailures.set(key, { failures: 1, resetAt: now + LOGIN_FAILURE_WINDOW_MS, lockedUntil: 0 })
    return
  }
  entry.failures += 1
  if (entry.failures >= LOGIN_MAX_FAILURES) entry.lockedUntil = now + LOGIN_LOCK_MS
}

// 修复说明：[低危-用户枚举]，原因：账号不存在时短路跳过 scrypt 校验，响应时间差异可被用于枚举有效账号；现对不存在/停用账号也执行一次等价 scrypt 校验再返回统一错误。
let dummyHashPromise = null
function dummyPasswordHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('nexfab-timing-equalizer-dummy-password')
  return dummyHashPromise
}

export function createAppServer() {
  return createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin === allowedOrigin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  // 修复说明：[低危-CORS]，原因：允许的方法列表缺少 DELETE，后续补删除接口时前端预检会失败；预防性补齐。
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  try {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    url.pathname = normalizeBasePath(url)
    if (req.method === 'GET' && url.pathname === '/health') {
      // 修复说明：[低危-信息暴露]，原因：/health 未认证即暴露数据库/会话/PII 配置状态，利于攻击者探测部署阶段；现仅返回存活状态，完整 checks 保留在 /ready。
      return send(res, 200, { ok: true, service: 'nexfab-crm-backend', phase: 1 })
    }
    if (req.method === 'GET' && url.pathname === '/ready') {
      const checks = configurationStatus()
      return send(res, checks.ready ? 200 : 503, { ok: checks.ready, service: 'nexfab-crm-backend', checks })
    }

    if (req.method === 'GET' && url.pathname === '/') {
      try {
        const preview = await readFile(previewFile)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        return res.end(preview)
      } catch {
        return send(res, 500, { error: { code: 'PREVIEW_UNAVAILABLE', message: '前端预览文件未找到。' } })
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(req)
      const loginId = body.loginId ?? body.account ?? body.username ?? body.email
      const password = text(body.password, '密码', { required: true, max: 512 })
      const attemptKey = loginAttemptKey(String(loginId ?? ''), req)
      assertLoginAllowed(attemptKey)
      const db = await prisma()
      const user = await findUserForLogin(db, loginId)
      if (!user || user.status !== 'ACTIVE') {
        await verifyPassword(password, await dummyPasswordHash())
        recordLoginFailure(attemptKey)
        throw new HttpError(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确。')
      }
      if (!(await verifyPassword(password, user.passwordHash))) {
        recordLoginFailure(attemptKey)
        throw new HttpError(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确。')
      }
      loginFailures.delete(attemptKey)
      await db.auditLog.create({ data: { userId: user.id, action: 'LOGIN', resource: 'session' } })
      const { passwordHash, ...safeUser } = user
      res.setHeader('Set-Cookie', sessionCookie(createSession(safeUser)))
      return send(res, 200, { data: { user: safeUser } })
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      // 修复说明：[低危-会话安全]，原因：logout 清除 cookie 时生产环境漏掉 Secure 属性；现补齐，并递增 tokenVersion 服务端撤销该用户全部会话。
      const logoutSecure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
      res.setHeader('Set-Cookie', `nexfab_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${logoutSecure}`)
      try {
        const session = sessionFromRequest(req)
        const db = await prisma()
        const current = await db.user.findUnique({ where: { id: session.sub }, select: { tokenVersion: true } })
        if (current) await db.user.update({ where: { id: session.sub }, data: { tokenVersion: (current.tokenVersion ?? 0) + 1 } })
      } catch {
        // 无有效会话或数据库不可用时仍完成 cookie 清除
      }
      return send(res, 204, {})
    }

    const session = sessionFromRequest(req)
    const db = await prisma()
    const actor = await authenticatedActor(session, db)
    if (req.method === 'GET' && url.pathname === '/api/auth/session') return send(res, 200, { data: { user: actor } })
    if (req.method === 'GET' && url.pathname === '/api/navigation') {
      const data = navigationFor(actor.role.toLowerCase())
      if (!data) return send(res, 500, { error: { code: 'ROLE_MAPPING_ERROR', allowed: Object.keys(ROLES) } })
      return send(res, 200, { data })
    }

    const opsHandled = await handleOpsRoute({ req, res, pathname: url.pathname, actor, db })
    if (opsHandled !== false) return opsHandled

    const importTemplateHandled = await handleImportTemplateRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (importTemplateHandled !== false) return importTemplateHandled
    const dashboardHandled = await handleDashboardRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (dashboardHandled !== false) return dashboardHandled
    const analyticsHandled = await handleAnalyticsRoute({ req, res, pathname: url.pathname, actor, db })
    if (analyticsHandled !== false) return analyticsHandled
    const acquisitionHandled = await handleAcquisitionRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (acquisitionHandled !== false) return acquisitionHandled
    const toolsHandled = await handleToolsRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (toolsHandled !== false) return toolsHandled
    const socialHandled = await handleSocialRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (socialHandled !== false) return socialHandled
    const outboundDraftHandled = await handleOutboundDraftRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (outboundDraftHandled !== false) return outboundDraftHandled
    const customerProfileHandled = await handleCustomerProfileRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (customerProfileHandled !== false) return customerProfileHandled
    const retentionHandled = await handleRetentionRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (retentionHandled !== false) return retentionHandled
    const handled = await handleCrmRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (handled !== false) return handled
    const productHandled = await handleProductRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (productHandled !== false) return productHandled
    const quoteHandled = await handleQuoteRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (quoteHandled !== false) return quoteHandled
    const orderHandled = await handleOrderRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (orderHandled !== false) return orderHandled
    const paymentHandled = await handlePaymentRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (paymentHandled !== false) return paymentHandled
    const timelineHandled = await handleTimelineRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (timelineHandled !== false) return timelineHandled
    const sampleHandled = await handleSampleRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (sampleHandled !== false) return sampleHandled
    const tradeDocumentHandled = await handleTradeDocumentRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (tradeDocumentHandled !== false) return tradeDocumentHandled
    const fulfillmentHandled = await handleFulfillmentRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (fulfillmentHandled !== false) return fulfillmentHandled
    const commissionHandled = await handleCommissionRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (commissionHandled !== false) return commissionHandled
    const knowledgeHandled = await handleKnowledgeRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (knowledgeHandled !== false) return knowledgeHandled
    const agentLibraryHandled = await handleAgentLibraryRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (agentLibraryHandled !== false) return agentLibraryHandled
    const aiGatewayHandled = await handleAiGatewayRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (aiGatewayHandled !== false) return aiGatewayHandled
    const automationHandled = await handleAutomationRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (automationHandled !== false) return automationHandled
    const integrationHandled = await handleIntegrationRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (integrationHandled !== false) return integrationHandled
    const ragHandled = await handleRagRoute({ req, res, url, pathname: url.pathname, actor, db })
    if (ragHandled !== false) return ragHandled
    const feature = plannedEndpoint(req.method, url.pathname)
    if (feature) return notImplemented(res, feature)
    return send(res, 404, { error: { code: 'NOT_FOUND', message: '未定义的接口。' } })
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { error: { code: error.code, message: error.message, detail: error.detail } })
    console.error(error)
    return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: '服务器发生未预期错误。' } })
  }
  })
}

if (process.env.NEXFAB_NO_LISTEN !== 'true') {
  const server = createAppServer()
  server.listen(port, '127.0.0.1', () => {
    console.log(`NexFab backend skeleton: http://127.0.0.1:${port}`)
  })
}
