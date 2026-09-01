import { aiQueueStatus } from './ai-queue.mjs'
import { configurationStatus } from './config.mjs'
import { HttpError, send } from './http.mjs'

function assertOpsAccess(actor) {
  if (actor.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', '仅系统管理员可以查看运行状态。')
}

function bytesToMiB(value) {
  return Number((value / 1024 / 1024).toFixed(1))
}

export async function handleOpsRoute({ req, res, pathname, actor, db }) {
  if (req.method !== 'GET' || pathname !== '/api/admin/ops/status') return false
  assertOpsAccess(actor)
  const startedAt = performance.now()
  try {
    await db.user.findUnique({ where: { id: actor.id }, select: { id: true } })
  } catch {
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', '数据库探针失败。')
  }
  const memory = process.memoryUsage()
  const memoryMode = process.env.NODE_ENV === 'test' && process.env.NEXFAB_MEMORY_TEST_DB === 'true'
  return send(res, 200, {
    data: {
      at: new Date().toISOString(),
      configuration: configurationStatus(),
      database: { reachable: true, mode: memoryMode ? 'memory-test' : 'postgresql', probe: 'authenticated-user-read', latencyMs: Number((performance.now() - startedAt).toFixed(1)) },
      queue: aiQueueStatus(),
      process: { uptimeSeconds: Math.floor(process.uptime()), rssMiB: bytesToMiB(memory.rss), heapUsedMiB: bytesToMiB(memory.heapUsed) },
      backup: { mode: 'manual-guarded', automatedExecution: false, note: '备份必须在独立发布门禁中执行；本状态接口不会创建或下载数据库备份。' },
    },
  })
}
