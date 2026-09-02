import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// 4a2147c 把角色卡邮箱改为 @nexfab.test，本脚本只补 5 个 .test 用户（不影响其它数据）
const TEST_USERS = [
  { email: 'admin@nexfab.test',    name: '张伟 (测试)', primaryRole: 'super_admin',    department: '总经办',  passwordHash: 'scrypt:062c41a481eb4fa7faab13b99c8d6acf:39f1f8724db45267bd69129c401400e5c6773f2d6d8634140e0b8401083a9a93861f3c32f4be1d7363b86b15735e5363e7650594e37d1e2241e25a1c595274ea' },
  { email: 'exec@nexfab.test',     name: '王芳 (测试)', primaryRole: 'management',     department: '管理层',  passwordHash: 'scrypt:ab87aa6a671ce2839bc81e6dc9788926:1e854978a0278ee332a3d1b5fbda6029e9edf2a9416b40efd28c1e1811e3ff450602478c506988ab84f739ed5dfc45a3d9e79ecd687a5157acc1b72f56934af0' },
  { email: 'manager@nexfab.test',  name: '李强 (测试)', primaryRole: 'sales_manager',  department: '销售部',  passwordHash: 'scrypt:4084df321a5cd00e76dc5923f09983e0:5754a2f9436ff3b860fc01c483298f7b7607faf9224b86fe8771a20a2425df1e2aed641bff8356a068c4249174b8c166cb6fb8a794202eac27187952fdaac7d5' },
  { email: 'sales@nexfab.test',    name: '陈明 (测试)', primaryRole: 'sales',          department: '销售部',  passwordHash: 'scrypt:73bc19a7151e6d915568b54a34fbdce0:dcf3e1bdb4a186858919ebb3e794654eef5fd8fc2f6d890385db112cece7145801bb01ef9ee3650ce21b36e71e8b11c6fc38d2329adf5b86edc5ad2dfcf9673f' },
  { email: 'finance@nexfab.test',  name: '赵雪 (测试)', primaryRole: 'finance',        department: '财务部',  passwordHash: 'scrypt:8880a0634cd42f0e6c97a5d3154f313f:4b4574565fa2b672ad05b11611df20eb56911f1135efbff5e84cf048dd1ff51af31f6266ca030f3305ea3efd143532c828388b7ca0b6c60336d9a649161f5934' },
]

async function main() {
  for (const u of TEST_USERS) {
    const r = await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash: u.passwordHash, isActive: true, name: u.name, primaryRole: u.primaryRole, department: u.department },
      create: { ...u, isActive: true },
    })
    console.log(`upsert: ${r.email} → role=${r.primaryRole} active=${r.isActive}`)
  }
}

main().finally(() => db.$disconnect())
