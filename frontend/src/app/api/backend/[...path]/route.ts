import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8787'

// 修复说明：[高危-SSRF/暴露面]，原因：catch-all 无白名单，后端任意路径（含 /api/admin/* 运维端点）被整体暴露且代理层零门槛；
// 现维护方法+前缀白名单，仅放行前端实际使用的业务 API；/api/admin 仅放行 ops/status 一只端点。
const ALLOWED_PREFIXES = [
  'api/auth/',
  'api/navigation',
  'api/dashboard',
  'api/ai-gateway/',
  'api/ai-queue/',
  'api/ai-capability-contracts',
  'api/ai-tasks/',
  'api/agent-library/',
  'api/rag/query',
  'api/tool-calls',
  'api/import/',
  'api/leads',
  'api/inquiries',
  'api/customers/',
  'api/tools/',
  'api/opportunities',
  'api/product-categories',
  'api/products/',
  'api/quote-rule-sets',
  'api/quotes/',
  'api/samples',
  'api/orders/',
  'api/payments',
  'api/knowledge-documents',
  'api/trade-documents',
  'api/shipments',
  'api/social-accounts',
  'api/social-posts',
  'api/social-interactions',
  'api/outbound-drafts',
  'api/analytics/operations-report',
]
const ALLOWED_LITERAL = new Set([
  'api/customers',
  'api/leads',
  'api/inquiries',
  'api/opportunities',
  'api/quotes',
  'api/products',
  'api/samples',
  'api/payments',
  'api/ai-tasks',
  'api/ai-capability-contracts',
  'api/agent-library/skills',
  'api/agent-library/knowledge',
  'api/quote-rule-sets',
  'api/trade-documents',
  'api/tool-calls',
  'api/social-accounts',
  'api/social-posts',
  'api/social-interactions',
  'api/outbound-drafts',
])
const ADMIN_LITERAL = new Set(['api/admin/ops/status'])

function isAllowedPath(segments: string[]): boolean {
  if (segments.some((segment) => segment === '..' || segment.includes('/') || segment.includes('\\'))) return false
  const joined = segments.join('/')
  if (ADMIN_LITERAL.has(joined)) return true
  if (segments[0] === 'api' && segments[1] === 'admin') return false
  if (ALLOWED_LITERAL.has(joined)) return true
  return ALLOWED_PREFIXES.some((prefix) => joined === prefix.replace(/\/$/, '') || joined.startsWith(prefix))
}

// 修复说明：[中危-CSRF]，原因：BFF 原样携带浏览器 cookie 转发全部写方法，无任何来源校验；现对写方法校验同源。
function assertSameOrigin(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') {
    throw new Error('CROSS_SITE_FORBIDDEN')
  }
  const origin = request.headers.get('origin')
  if (origin) {
    const host = request.headers.get('host')
    try {
      if (new URL(origin).host !== host) throw new Error('CROSS_SITE_FORBIDDEN')
    } catch {
      throw new Error('CROSS_SITE_FORBIDDEN')
    }
  }
}

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params
    // 修复说明：[低危-路径遍历]，原因：段未编码、未拒绝 ..，规范化可命中后端未预期路由；现逐段编码并显式拒绝危险段。
    const safeSegments = (path || []).map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    if (!isAllowedPath(safeSegments.map((segment) => decodeURIComponent(segment)))) {
      return NextResponse.json({ error: { code: 'PROXY_PATH_FORBIDDEN', message: '该接口未开放代理。' } }, { status: 403 })
    }
    assertSameOrigin(request)
    const target = new URL(`/${safeSegments.join('/')}`, BACKEND_URL)
    target.search = request.nextUrl.search

    const headers = new Headers()
    const contentType = request.headers.get('content-type')
    const cookie = request.headers.get('cookie')
    if (contentType) headers.set('content-type', contentType)
    if (cookie) headers.set('cookie', cookie)

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
    }
    // 修复说明：[中危-数据完整性]，原因：request.text() 做 UTF-8 解码，二进制上传会被替换字符损坏；改用 arrayBuffer 原样透传。
    if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer()

    const upstream = await fetch(target, init)
    const responseHeaders = new Headers()
    const upstreamType = upstream.headers.get('content-type')
    if (upstreamType) responseHeaders.set('content-type', upstreamType)
    for (const name of ['cache-control', 'x-accel-buffering']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    // 修复说明：[中危-数据完整性]，原因：Headers.get('set-cookie') 把多条 Set-Cookie 逗号合并成一条，破坏 cookie 属性；改用 getSetCookie 逐条 append。
    const setCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : []
    for (const cookieValue of setCookies) responseHeaders.append('set-cookie', cookieValue)

    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'CROSS_SITE_FORBIDDEN') {
      return NextResponse.json({ error: { code: 'CROSS_SITE_FORBIDDEN', message: '跨站请求被拒绝。' } }, { status: 403 })
    }
    return NextResponse.json({ error: { code: 'PROXY_ERROR', message: '代理请求失败。' } }, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
