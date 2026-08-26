const listeners = new Map()
const history = new Map()
let nextEventId = 1
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])

function redactText(value) {
  return value
    .replace(/OPENAI_API_KEY|SESSION_SECRET|DATABASE_URL|passwordHash|apiKey|secret|token|authorization|cookie/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[redacted-phone]')
}

export function safeEventValue(value, depth = 0) {
  if (depth > 3) return '[truncated]'
  if (value == null) return value
  if (typeof value === 'string') return redactText(value).slice(0, 300)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => safeEventValue(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => {
      if (/apiKey|password|secret|token|authorization|cookie/i.test(key)) return [key, '[redacted]']
      if (/email|phone|mobile|whatsapp/i.test(key)) return [key, '[redacted-pii]']
      if (/input|prompt/i.test(key) && depth > 0) return [key, '[redacted-summary-only]']
      return [key, safeEventValue(item, depth + 1)]
    }))
  }
  return redactText(String(value)).slice(0, 300)
}

export function appendAiTaskEvent(taskId, payload) {
  const event = {
    id: String(nextEventId++),
    taskId,
    at: new Date().toISOString(),
    type: payload.type || 'status',
    status: payload.status || null,
    stage: payload.stage || null,
    terminal: TERMINAL_STATUSES.has(payload.status),
    tokens: Number(payload.tokens || 0),
    cost: String(payload.cost ?? '0'),
    durationMs: Number(payload.durationMs || 0),
    dataSentToCloud: payload.dataSentToCloud === true,
    summary: safeEventValue(payload.summary || {}),
    queueBackend: payload.queueBackend || null,
    errorCode: payload.errorCode || null,
  }
  const rows = history.get(taskId) || []
  rows.push(event)
  history.set(taskId, rows.slice(-100))
  for (const listener of listeners.get(taskId) || []) listener(event)
  return event
}

export function aiTaskEventHistory(taskId) {
  return history.get(taskId) || []
}

function writeSse(res, event) {
  res.write(`id: ${event.id}\n`)
  res.write(`event: ${event.type}\n`)
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

export function startAiTaskSse({ req, res, taskId }) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')
  for (const event of aiTaskEventHistory(taskId)) writeSse(res, event)

  const listener = (event) => writeSse(res, event)
  if (!listeners.has(taskId)) listeners.set(taskId, new Set())
  listeners.get(taskId).add(listener)

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ taskId, at: new Date().toISOString() })}\n\n`)
  }, 10000)

  const cleanup = () => {
    clearInterval(heartbeat)
    listeners.get(taskId)?.delete(listener)
    if (listeners.get(taskId)?.size === 0) listeners.delete(taskId)
  }
  req.on('close', cleanup)
  res.on('error', cleanup)
}
