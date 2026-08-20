import ZAI from 'z-ai-web-dev-sdk'
import { NextRequest } from 'next/server'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

const SYSTEM_PROMPT = `你是 NexFab AI CRM 智能助手，专注于外贸领域。你能够帮助用户进行客户分析、回复草拟、价格建议和市场洞察。
请用与用户消息相同的语言回复。保持专业、简洁、实用的回答风格。`

/**
 * 将完整文本拆分为小块，模拟流式输出效果
 * 中文按2-3字一组，英文按1-2词一组，实现自然打字节奏
 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    // 中文字符：2-3个一组
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      const size = Math.min(2 + Math.floor(Math.random() * 2), text.length - i)
      chunks.push(text.slice(i, i + size))
      i += size
    }
    // 英文单词 + 空格
    else if (/[a-zA-Z0-9]/.test(char)) {
      let end = i
      while (end < text.length && /[a-zA-Z0-9']/.test(text[end])) end++
      chunks.push(text.slice(i, end))
      i = end
    }
    // 标点/空白/其他：单独或成组
    else {
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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          )
          // 模拟打字延迟：每个块之间 15-40ms
          await new Promise((r) => setTimeout(r, 15 + Math.random() * 25))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'AI回复生成中断' })}\n\n`)
        )
        controller.close()
      }
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // 支持两种格式：
  // 1. { messages: [{role, content}, ...], context?: string }  — 多轮对话
  // 2. { message: string, context?: string }                    — 单轮兼容
  const rawMessages: Array<{ role: string; content: string }> | undefined = body.messages
  const singleMessage: string | undefined = body.message
  const context: string | undefined = body.context

  // 构建消息列表
  const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
    { role: 'assistant', content: SYSTEM_PROMPT },
  ]

  if (Array.isArray(rawMessages) && rawMessages.length > 0) {
    // 多轮模式：直接使用传入的 messages
    for (const msg of rawMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
  } else if (typeof singleMessage === 'string' && singleMessage.trim()) {
    // 单轮兼容模式
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

  // 调用 LLM 获取完整回复
  let replyContent: string
  try {
    const zai = await getZAI()
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })
    replyContent = completion.choices?.[0]?.message?.content || ''
  } catch (error) {
    console.error('AI Chat error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'AI回复生成失败，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!replyContent.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: 'AI未返回有效回复' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 以 SSE 流式返回
  const stream = createSSEStream(replyContent)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
