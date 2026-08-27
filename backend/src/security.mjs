import { createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { HttpError } from './http.mjs'

const scrypt = promisify(scryptCallback)
const SESSION_TTL_SECONDS = 60 * 60 * 8

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new HttpError(503, 'SESSION_NOT_CONFIGURED', '会话服务尚未配置。')
  return value
}
function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url') }
function sign(value) { return createHmac('sha256', secret()).update(value).digest('base64url') }

export async function hashPassword(password) {
  const salt = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`
}

export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string') return false
  const [salt, expected] = hash.split(':')
  if (!salt || !expected) return false
  const actual = Buffer.from(await scrypt(password, salt, 64)).toString('hex')
  const left = Buffer.from(actual, 'hex'), right = Buffer.from(expected, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function createSession(user) {
  const payload = { sub: user.id, role: user.role, teamId: user.teamId || null, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }
  const body = encode(payload)
  return `${body}.${sign(body)}`
}

export function sessionFromRequest(req) {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('nexfab_session='))?.slice('nexfab_session='.length)
  const token = bearer || cookie
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', '需要登录会话。')
  const [body, signature] = token.split('.')
  const expected = Buffer.from(sign(body))
  const received = Buffer.from(signature)
  if (!body || !signature || expected.length !== received.length || !timingSafeEqual(expected, received)) throw new HttpError(401, 'INVALID_SESSION', '会话无效。')
  let payload
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { throw new HttpError(401, 'INVALID_SESSION', '会话无效。') }
  if (!payload.sub || !payload.role || payload.exp <= Math.floor(Date.now() / 1000)) throw new HttpError(401, 'SESSION_EXPIRED', '会话已过期。')
  return payload
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `nexfab_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`
}
