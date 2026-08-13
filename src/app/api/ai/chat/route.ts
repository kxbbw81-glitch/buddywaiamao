import ZAI from 'z-ai-web-dev-sdk'
import { NextRequest, NextResponse } from 'next/server'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(request: NextRequest) {
  const { message, context, stream } = await request.json()

  if (!message) {
    return NextResponse.json({ success: false, error: '消息不能为空' }, { status: 400 })
  }

  const systemPrompt = `你是 NexFab AI CRM 智能助手，专注于外贸领域。你能够帮助用户进行客户分析、回复草拟、价格建议和市场洞察。
请用与用户消息相同的语言回复。保持专业、简洁、实用的回答风格。`

  const messages = [
    { role: 'assistant' as const, content: systemPrompt },
    { role: 'user' as const, content: context ? `[上下文信息]: ${context}\n\n[用户问题]: ${message}` : message },
  ]

  // Stream mode
  if (stream) {
    try {
      const zai = await getZAI()
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const completion = await zai.chat.completions.create({
              messages,
              thinking: { type: 'disabled' },
            })
            const content = completion.choices?.[0]?.message?.content || ''
            // Send content in chunks for streaming feel
            const words = content.split('')
            for (const char of words) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: char })}\n\n`))
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI回复生成失败' })}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } catch (error) {
      return NextResponse.json({ success: false, error: 'AI流式回复失败' }, { status: 500 })
    }
  }

  // Non-stream mode
  try {
    const zai = await getZAI()
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices?.[0]?.message?.content || ''

    return NextResponse.json({ success: true, data: { content: reply } })
  } catch (error) {
    console.error('AI Chat error:', error)
    return NextResponse.json({ success: false, error: 'AI回复生成失败' }, { status: 500 })
  }
}
