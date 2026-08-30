import { PrismaClient } from '@prisma/client'
import { planFingerprintBackfill, planPiiRecordBackfill } from '../src/pii-backfill-plan.mjs'

const apply = process.argv.includes('--apply')
const batchSizeArg = process.argv.find((value) => value.startsWith('--batch-size='))
const batchSize = Number(batchSizeArg?.split('=')[1] || 100)
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('batch-size 必须是 1 到 1000 的整数。')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置；拒绝执行 PII backfill。')
if (!process.env.PII_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) throw new Error('PII_ENCRYPTION_KEY 或 ENCRYPTION_KEY 未配置；拒绝执行 PII backfill。')

const db = new PrismaClient()
const summary = { mode: apply ? 'apply' : 'dry-run', contacts: { scanned: 0, updated: 0, conflicts: 0 }, leads: { scanned: 0, updated: 0, conflicts: 0 }, fingerprints: { scanned: 0, updated: 0, conflicts: 0, invalid: 0 } }

async function backfillRecords(model, label) {
  let afterId = null
  while (true) {
    const rows = await db[model].findMany({
      where: { AND: [{ OR: [{ email: { not: null } }, { phone: { not: null } }] }, ...(afterId ? [{ id: { gt: afterId } }] : [])] },
      select: { id: true, email: true, phone: true, emailCiphertext: true, phoneCiphertext: true },
      take: batchSize,
      orderBy: { id: 'asc' },
    })
    if (!rows.length) return
    afterId = rows.at(-1).id
    for (const row of rows) {
      summary[label].scanned += 1
      const plan = planPiiRecordBackfill(row)
      summary[label].conflicts += plan.conflicts.length
      if (!plan.actionable) continue
      if (apply) await db[model].update({ where: { id: row.id }, data: plan.data })
      summary[label].updated += 1
    }
    if (rows.length < batchSize) return
  }
}

async function backfillFingerprints() {
  let afterId = null
  while (true) {
    const rows = await db.customerFingerprint.findMany({
      where: { AND: [{ type: { in: ['EMAIL', 'PHONE'] } }, ...(afterId ? [{ id: { gt: afterId } }] : [])] },
      select: { id: true, customerId: true, type: true, value: true, normalized: true },
      take: batchSize,
      orderBy: { id: 'asc' },
    })
    if (!rows.length) return
    afterId = rows.at(-1).id
    for (const row of rows) {
      summary.fingerprints.scanned += 1
      const plan = planFingerprintBackfill(row)
      if (plan.state === 'already-protected') continue
      if (plan.state === 'invalid') { summary.fingerprints.invalid += 1; continue }
      // 修复说明：[中危-脚本安全]，原因：指纹唯一约束是 (type, normalized) 全局唯一，仅按 customerId 查重会漏检他客户占用，--apply 时 P2002 中断脚本；改全局查重。
      const duplicate = await db.customerFingerprint.findFirst({ where: { type: row.type, normalized: plan.data.normalized }, select: { id: true, customerId: true } })
      if (duplicate && duplicate.id !== row.id) { summary.fingerprints.conflicts += 1; continue }
      if (apply) await db.customerFingerprint.update({ where: { id: row.id }, data: plan.data })
      summary.fingerprints.updated += 1
    }
    if (rows.length < batchSize) return
  }
}

try {
  await backfillRecords('contact', 'contacts')
  await backfillRecords('lead', 'leads')
  await backfillFingerprints()
  console.log(JSON.stringify(summary))
} finally {
  await db.$disconnect()
}
