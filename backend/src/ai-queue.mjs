import { appendAiTaskEvent } from './ai-task-events.mjs'

let bullQueue
let bullWorker
let bullConnection
let processorRef

export function aiQueueStatus(env = process.env) {
  const redisUrl = env.AI_QUEUE_REDIS_URL || env.REDIS_URL || ''
  const redisConfigured = Boolean(redisUrl)
  if (redisConfigured) {
    return { enabled: true, backend: 'bullmq-redis', redisConfigured: true, productionReady: true, fallback: false, sse: true }
  }
  const memoryAllowed = env.NODE_ENV !== 'production' && env.NEXFAB_AI_QUEUE_MEMORY_FALLBACK !== 'false'
  if (memoryAllowed) {
    return { enabled: true, backend: 'memory', redisConfigured: false, productionReady: false, fallback: true, sse: true, warning: '仅限本地开发/测试，生产必须配置 Redis + BullMQ。' }
  }
  return { enabled: false, backend: 'disabled', redisConfigured: false, productionReady: false, fallback: false, sse: false, warning: '未配置 Redis，且当前环境不允许 in-memory fallback。' }
}

async function ensureBullQueue(processor) {
  if (!bullQueue) {
    const [{ Queue, Worker }, Redis] = await Promise.all([import('bullmq'), import('ioredis')])
    bullConnection = new Redis.default(process.env.AI_QUEUE_REDIS_URL || process.env.REDIS_URL, { maxRetriesPerRequest: null })
    bullQueue = new Queue('nexfab-ai-tasks', { connection: bullConnection })
    processorRef = processor
    bullWorker = new Worker('nexfab-ai-tasks', async (job) => processorRef(job.data), { connection: bullConnection })
    bullWorker.on('failed', (job, error) => {
      if (job?.data?.taskId) appendAiTaskEvent(job.data.taskId, { type: 'error', status: 'FAILED', stage: 'queue_failed', errorCode: 'QUEUE_WORKER_FAILED', summary: { message: error?.message }, queueBackend: 'bullmq-redis' })
    })
  } else {
    processorRef = processor
  }
  return bullQueue
}

export async function enqueueAiTaskJob(job, processor) {
  const status = aiQueueStatus()
  if (!status.enabled) return { ...status, accepted: false }
  appendAiTaskEvent(job.taskId, { type: 'status', status: 'QUEUED', stage: 'queued', queueBackend: status.backend, summary: { productionReady: status.productionReady } })
  if (status.backend === 'memory') {
    setTimeout(() => {
      processor({ ...job, queueBackend: status.backend }).catch((error) => {
        appendAiTaskEvent(job.taskId, { type: 'error', status: 'FAILED', stage: 'memory_worker_failed', errorCode: 'MEMORY_WORKER_FAILED', summary: { message: error?.message }, queueBackend: status.backend })
      })
    }, 0)
    return { ...status, accepted: true }
  }
  const queue = await ensureBullQueue(processor)
  const queued = await queue.add('ai-task', job, { removeOnComplete: 100, removeOnFail: 100 })
  return { ...status, accepted: true, jobId: queued.id }
}

export async function closeAiQueue() {
  await bullWorker?.close().catch(() => undefined)
  await bullQueue?.close().catch(() => undefined)
  await bullConnection?.quit().catch(() => undefined)
  bullWorker = undefined
  bullQueue = undefined
  bullConnection = undefined
  processorRef = undefined
}
