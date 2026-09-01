import { randomInt } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/security.mjs'

const apply = process.argv.includes('--apply')
const confirmation = process.env.NEXFAB_CONFIRM_ROLE_ACCOUNTS
const domain = (process.env.NEXFAB_ROLE_ACCOUNT_EMAIL_DOMAIN || 'nexfab.test').trim().toLowerCase()
const passwordMode = process.env.NEXFAB_ROLE_ACCOUNT_PASSWORD_MODE || 'RANDOM'
const accounts = [
  { email: `sales@${domain}`, name: '销售专员', role: 'SALES' },
  { email: `manager@${domain}`, name: '销售经理', role: 'MANAGER' },
  { email: `finance@${domain}`, name: '财务专员', role: 'FINANCE' },
  { email: `exec@${domain}`, name: '高管', role: 'EXEC' },
]

// 修复说明：[账号安全]，原因：初始口令不得复用测试口令或落盘；仅在进程内生成逐账号强随机密码，并只持久化哈希。
function generatePassword() {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-+=']
  const pick = (pool) => pool[randomInt(pool.length)]
  const chars = groups.map(pick)
  const all = groups.join('')
  while (chars.length < 18) chars.push(pick(all))
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const next = randomInt(index + 1)
    ;[chars[index], chars[next]] = [chars[next], chars[index]]
  }
  return chars.join('')
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置；拒绝创建角色账号。')
if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(domain)) throw new Error('NEXFAB_ROLE_ACCOUNT_EMAIL_DOMAIN 无效。')
if (apply && confirmation !== 'CREATE_ROLE_ACCOUNTS') throw new Error('需要 NEXFAB_CONFIRM_ROLE_ACCOUNTS=CREATE_ROLE_ACCOUNTS 才允许写入角色账号。')
if (!['RANDOM', 'LOGIN_EQUALS_PASSWORD'].includes(passwordMode)) throw new Error('NEXFAB_ROLE_ACCOUNT_PASSWORD_MODE 仅支持 RANDOM 或 LOGIN_EQUALS_PASSWORD。')
if (apply && passwordMode === 'LOGIN_EQUALS_PASSWORD' && process.env.NEXFAB_CONFIRM_WEAK_ROLE_PASSWORDS !== 'ALLOW_LOGIN_EQUALS_PASSWORD') {
  throw new Error('账号同密码属于弱口令；需要 NEXFAB_CONFIRM_WEAK_ROLE_PASSWORDS=ALLOW_LOGIN_EQUALS_PASSWORD 才允许写入。')
}

const db = new PrismaClient()
try {
  const existing = await db.user.findMany({ where: { email: { in: accounts.map((item) => item.email) } }, select: { email: true, role: true, status: true } })
  const summary = { mode: apply ? 'apply' : 'dry-run', requestedRoles: accounts.map((item) => item.role), existing }
  if (!apply) {
    console.log(JSON.stringify({ ...summary, wouldCreate: accounts.filter((item) => !existing.some((row) => row.email === item.email)).map((item) => ({ email: item.email, role: item.role })) }))
    process.exit(0)
  }
  if (existing.length) throw new Error(`目标账号已存在，拒绝覆盖：${existing.map((item) => item.email).join(', ')}`)
  const created = await db.$transaction(async (tx) => {
    const rows = []
    for (const account of accounts) {
      // 修复说明：[账号安全]，原因：用户明确指定账号同密码时仍需双确认并留痕，避免默认弱口令或意外配置生效。
      const password = passwordMode === 'LOGIN_EQUALS_PASSWORD' ? account.email : generatePassword()
      const passwordHash = await hashPassword(password)
      const row = await tx.user.create({ data: { ...account, status: 'ACTIVE', passwordHash }, select: { id: true, email: true, role: true, status: true } })
      await tx.auditLog.create({ data: { userId: row.id, action: 'CREATE_ROLE_ACCOUNT', resource: 'user', resourceId: row.id, detail: { role: row.role, passwordStored: 'hash-only', plaintextLogged: false, passwordMode, weakPasswordExplicitlyConfirmed: passwordMode === 'LOGIN_EQUALS_PASSWORD' } } })
      rows.push(row)
    }
    return rows
  })
  console.log(JSON.stringify({ ...summary, created: created.map((item) => ({ email: item.email, role: item.role, status: item.status })), plaintextPasswordOutput: false }))
} finally {
  await db.$disconnect()
}
