export class HttpError extends Error {
  constructor(status, code, message, detail) {
    super(message)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

export async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '请求体不能超过 64KB。')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, 'INVALID_JSON', '请求体必须是有效 JSON。') }
}

export function listQuery(url) {
  const page = Number(url.searchParams.get('page') || 1)
  const pageSize = Number(url.searchParams.get('pageSize') || 20)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new HttpError(400, 'INVALID_PAGINATION', 'page 必须大于 0，pageSize 必须在 1 到 100 之间。')
  }
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function text(value, field, { required = false, max = 255 } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  if (typeof value !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是文本。`)
  const result = value.trim()
  if (!result || result.length > max) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 长度不合法。`)
  return result
}
