import { HttpError, text } from './http.mjs'

// 修复说明：[低危-会话安全]，配套 tokenVersion 撤销机制，登录签发时携带版本号。
export const loginUserSelect = { id: true, email: true, name: true, role: true, status: true, teamId: true, tokenVersion: true, passwordHash: true }

function normalizeLoginId(value) {
  return text(value, '账号或邮箱', { required: true, max: 160 })?.toLowerCase()
}

export async function findUserForLogin(db, rawLoginId, env = process.env) {
  const loginId = normalizeLoginId(rawLoginId)
  if (loginId.includes('@')) return db.user.findUnique({ where: { email: loginId }, select: loginUserSelect })

  const adminAlias = (env.NEXFAB_ADMIN_LOGIN_ALIAS || 'admin').toLowerCase()
  if (loginId !== adminAlias) return null

  const configuredEmail = env.NEXFAB_ADMIN_LOGIN_EMAIL?.trim().toLowerCase()
  if (configuredEmail) return db.user.findUnique({ where: { email: configuredEmail }, select: loginUserSelect })

  const admins = await db.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: loginUserSelect, orderBy: { createdAt: 'asc' }, take: 2 })
  if (admins.length === 1) return admins[0]
  if (admins.length > 1) throw new HttpError(409, 'ADMIN_ALIAS_AMBIGUOUS', '存在多个启用管理员，请配置 NEXFAB_ADMIN_LOGIN_EMAIL 后再使用 admin 登录。')
  return null
}
