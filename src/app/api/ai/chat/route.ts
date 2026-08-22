import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getActiveAiConfig } from '@/lib/ai-settings'
import { callLlm, type ChatMessage } from '@/lib/agent-llm'

const SYSTEM_PROMPT = `你是 NexFab AI CRM 智能助手，专注于外贸领域。你能够帮助用户进行客户分析、回复草拟、价格建议和市场洞察。
请用与用户消息相同的语言回复。保持专业、简洁、实用的回答风格。`

/**
 * 将完整文本拆分为小块，模拟流式输出效果
 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      const size = Math.min(2 + Math.floor(Math.random() * 2), text.length - i)
      chunks.push(text.slice(i, i + size))
      i += size
    } else if (/[a-zA-Z0-9]/.test(char)) {
      let end = i
      while (end < text.length && /[a-zA-Z0-9']/.test(text[end])) end++
      chunks.push(text.slice(i, end))
      i = end
    } else {
      const size = Math.min(1 + Math.floor(Math.random() * 2), text.length - i)
      chunks.push(text.slice(i, i + size))
      i += size
    }
  }
  return chunks
}

function createSSEStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = splitIntoChunks(content)
  return new ReadableStream({
    async start(controller) {
      try {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
          await new Promise((r) => setTimeout(r, 15 + Math.random() * 25))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI回复生成中断' })}\n\n`))
        controller.close()
      }
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await request.json()

  const rawMessages: Array<{ role: string; content: string }> | undefined = body.messages
  const singleMessage: string | undefined = body.message
  const context: string | undefined = body.context

  const messages: ChatMessage[] = []
  if (Array.isArray(rawMessages) && rawMessages.length > 0) {
    for (const msg of rawMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
  } else if (typeof singleMessage === 'string' && singleMessage.trim()) {
    const userContent = context
      ? `[上下文信息]: ${context}\n\n[用户问题]: ${singleMessage.trim()}`
      : singleMessage.trim()
    messages.push({ role: 'user', content: userContent })
  } else {
    return new Response(JSON.stringify({ success: false, error: '消息不能为空' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const config = await getActiveAiConfig(auth.user.id)
  const reply = await callLlm(messages, SYSTEM_PROMPT, config)

  if (!reply || !reply.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        error: config.configured
          ? 'AI 服务调用失败，请稍后重试'
          : 'AI 服务未配置，请前往系统管理 → AI 配置接入供应商',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = createSSEStream(reply)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
