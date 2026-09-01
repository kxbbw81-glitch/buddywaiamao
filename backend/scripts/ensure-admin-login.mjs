import { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword } from '../src/security.mjs'

const confirm = process.env.NEXFAB_CONFIRM_ADMIN_LOGIN_FIX
const email = (process.env.NEXFAB_ADMIN_LOGIN_EMAIL || 'admin@nexfab.test').trim().toLowerCase()
const name = (process.env.NEXFAB_ADMIN_NAME || '系统管理员').trim()
const password = process.env.NEXFAB_ADMIN_PASSWORD
const allowShortPassword = process.env.NEXFAB_ALLOW_SHORT_ADMIN_PASSWORD === 'ALLOW_SHORT_ADMIN_PASSWORD'
const apply = process.argv.includes('--apply')

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置；拒绝检查管理员登录。')
if (!email.includes('@')) throw new Error('NEXFAB_ADMIN_LOGIN_EMAIL 必须是有效邮箱。')
if (apply && confirm !== 'FIX_ADMIN_LOGIN') throw new Error('需要 NEXFAB_CONFIRM_ADMIN_LOGIN_FIX=FIX_ADMIN_LOGIN 才允许写入管理员登录修复。')
if (apply && !password) throw new Error('NEXFAB_ADMIN_PASSWORD 未配置；拒绝写入。')
if (apply && password.length < 6 && !allowShortPassword) {
  throw new Error('NEXFAB_ADMIN_PASSWORD 长度不足；如确需临时短密码，必须设置 NEXFAB_ALLOW_SHORT_ADMIN_PASSWORD=ALLOW_SHORT_ADMIN_PASSWORD。')
}

const db = new PrismaClient()
try {
  const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true, name: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 20 })
  const activeAdmins = admins.filter((item) => item.status === 'ACTIVE')
  const target = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, status: true, passwordHash: true } })
  const passwordMatches = target && password ? await verifyPassword(password, target.passwordHash) : null
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    targetEmail: email,
    adminCount: admins.length,
    activeAdminCount: activeAdmins.length,
    targetExists: Boolean(target),
    targetActive: target?.status === 'ACTIVE',
    passwordChecked: Boolean(password),
    passwordMatches,
    aliasAdminUsableWithoutExplicitEmail: activeAdmins.length === 1,
    changed: false,
  }
  if (!apply) {
    console.log(JSON.stringify(summary))
    process.exit(0)
  }
  const passwordHash = await hashPassword(password)
  let row
  if (target) {
    row = await db.user.update({ where: { email }, data: { name, role: 'ADMIN', status: 'ACTIVE', passwordHash }, select: { id: true, email: true, name: true, role: true, status: true } })
  } else {
    row = await db.user.create({ data: { email, name, role: 'ADMIN', status: 'ACTIVE', passwordHash }, select: { id: true, email: true, name: true, role: true, status: true } })
  }
  await db.auditLog.create({ data: { userId: row.id, action: 'ADMIN_LOGIN_FIX', resource: 'user', resourceId: row.id, detail: { targetEmail: row.email, passwordStored: 'hash-only', plaintextLogged: false } } })
  console.log(JSON.stringify({ ...summary, changed: true, targetExists: true, targetActive: true, passwordMatches: true, user: { id: row.id, email: row.email, role: row.role, status: row.status } }))
} finally {
  await db.$disconnect()
}
