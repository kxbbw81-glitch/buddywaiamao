import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { User } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * NexFab CRM 认证与数据权限模块
 *
 * 会话机制：HMAC-SHA256 签名的 HTTP-only Cookie（nexfab_session）
 * 数据权限：sales 角色只能访问自己名下的数据；sales_manager / management / super_admin / finance 可见全部
 */

export const SESSION_COOKIE = 'nexfab_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

function getSecret(): string {
  return process.env.AUTH_SECRET || 'nexfab-dev-secret-change-in-production'
}

// ============ 会话令牌 ============

interface SessionPayload {
  uid: string
  iat: number
  exp: number
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function createSessionToken(userId: string): string {
  const now = Date.now()
  const payload: SessionPayload = { uid: userId, iat: now, exp: now + SESSION_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [body, signature] = token.split('.')
    if (!body || !signature) return null
    const expected = sign(body)
    // 时间安全比较，防止时序攻击
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ============ Cookie 读写 ============

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

// ============ 会话用户 ============

export type PublicUser = Omit<User, 'passwordHash'>

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _ignored, ...rest } = user
  return rest
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = verifySessionToken(token)
  if (!payload) return null
  const user = await db.user.findUnique({ where: { id: payload.uid } })
  if (!user || !user.isActive) return null
  return toPublicUser(user)
}

// ============ 路由守卫 ============

const MANAGER_ROLES = ['super_admin', 'management', 'sales_manager']
const ALL_ROLES = ['super_admin', 'management', 'sales_manager', 'sales', 'finance']

type GuardResult =
  | { ok: true; user: PublicUser }
  | { ok: false; response: NextResponse }

/**
 * API 路由守卫：校验会话，可选校验角色
 * 用法：
 *   const auth = await requireAuth()
 *   if (!auth.ok) return auth.response
 *   const user = auth.user
 */
export async function requireAuth(roles?: string[]): Promise<GuardResult> {
  const user = await getSessionUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 }
      ),
    }
  }
  if (roles && roles.length > 0) {
    const granted = [...roles].some((r) => r === user.primaryRole)
    if (!granted) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: '无权限执行此操作' },
          { status: 403 }
        ),
      }
    }
  }
  return { ok: true, user }
}

export function isManager(user: PublicUser): boolean {
  return MANAGER_ROLES.includes(user.primaryRole)
}

export function isSuperAdmin(user: PublicUser): boolean {
  return user.primaryRole === 'super_admin'
}

// ============ 数据权限范围 ============

/**
 * 客户数据范围过滤：
 * - sales：仅自己名下（ownerId = 自己）
 * - 其他角色（经理以上 / 财务）：全部
 * 返回 Prisma where 片段，调用方合并进自己的 where
 */
export function customerScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole === 'sales') {
    return { ownerId: user.id }
  }
  return {}
}

/**
 * 线索/商机数据范围过滤：sales 仅看分配给自己的
 */
export function assignedScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole === 'sales') {
    return { assignedTo: user.id }
  }
  return {}
}

/**
 * 商机数据范围过滤：sales 仅看本人名下（ownerId），其余角色全量
 */
export function opportunityScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole === 'sales') {
    return { ownerId: user.id }
  }
  return {}
}

// ============ 密码工具（scrypt，无外部依赖） ============

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return true // 未设密码的用户（演示模式）直接放行
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hash] = parts
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex')
  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export { MANAGER_ROLES, ALL_ROLES }
