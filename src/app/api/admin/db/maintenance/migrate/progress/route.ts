import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getMaintenanceLog } from '@/lib/db-maintenance'

/**
 * GET /api/admin/db/maintenance/migrate/progress?id=<jobId>
 * SSE 流式推送迁移进度（每 1s 轮询 MaintenanceLog.eventsJson，推送新增 event）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return new Response(JSON.stringify({ success: false, error: '缺少 id 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      let lastCount = 0
      // 最多轮询 120 次（约 2 分钟）
      for (let i = 0; i < 120; i++) {
        const log = await getMaintenanceLog(id)
        if (!log) {
          send({ error: 'job not found' })
          break
        }
        const events = JSON.parse(log.eventsJson || '[]') as unknown[]
        if (events.length > lastCount) {
          for (const ev of events.slice(lastCount)) send(ev)
          lastCount = events.length
        }
        if (['completed', 'failed', 'cancelled'].includes(log.status)) {
          send({ status: log.status, completed: true })
          break
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
