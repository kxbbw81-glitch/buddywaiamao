// 一次性 backfill：按角色设置现有用户 dataScope，种默认 Team 与 3 个内置 PermissionTemplate
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const m = env.match(/DATABASE_URL="([^"]+)"/)
if (m) process.env.DATABASE_URL = m[1]

const db = new PrismaClient()

async function main() {
  // 1. backfill dataScope by role
  const users = await db.user.findMany()
  let updated = 0
  for (const u of users) {
    let scope = 'personal'
    if (u.primaryRole === 'super_admin') scope = 'super'
    else if (['management', 'sales_manager', 'finance'].includes(u.primaryRole)) scope = 'global'
    if (u.dataScope !== scope) {
      await db.user.update({ where: { id: u.id }, data: { dataScope: scope } })
      updated++
    }
  }
  console.log(`dataScope backfill: ${updated}/${users.length} users updated`)

  // 2. default team
  await db.team.upsert({
    where: { name: '默认团队' },
    update: {},
    create: { name: '默认团队' },
  })
  console.log('default team seeded')

  // 3. builtin permission templates
  const templates = [
    {
      name: '销售业务员',
      code: 'sales',
      description: '仅本人名下数据',
      permissionsJson: JSON.stringify({ customer: ['read_own'], inquiry: ['read_own'], quotation: ['read_own', 'create'], order: ['read_own'] }),
    },
    {
      name: '销售经理',
      code: 'sales_manager',
      description: '团队数据 + 审批',
      permissionsJson: JSON.stringify({ customer: ['read_team'], inquiry: ['read_team', 'assign'], quotation: ['read_team', 'approve'], order: ['read_team'] }),
    },
    {
      name: '超级管理员',
      code: 'super_admin',
      description: '全局数据 + 系统管理',
      permissionsJson: JSON.stringify({ '*': ['*'] }),
    },
  ]
  for (const t of templates) {
    await db.permissionTemplate.upsert({
      where: { code: t.code },
      update: { name: t.name, description: t.description, permissionsJson: t.permissionsJson, isBuiltin: true },
      create: { ...t, isBuiltin: true },
    })
  }
  console.log(`permission templates seeded: ${templates.length}`)

  console.log('backfill done')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
