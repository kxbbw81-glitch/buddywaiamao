import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8787'

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  const target = new URL(`/${path.join('/')}`, BACKEND_URL)
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
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text()

  const upstream = await fetch(target, init)
  const responseHeaders = new Headers()
  const upstreamType = upstream.headers.get('content-type')
  if (upstreamType) responseHeaders.set('content-type', upstreamType)
  for (const name of ['cache-control', 'x-accel-buffering']) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  const setCookie = upstream.headers.get('set-cookie')
  if (setCookie) responseHeaders.set('set-cookie', setCookie)

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
