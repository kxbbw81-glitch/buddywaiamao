import { LLM } from 'z-ai-web-dev-sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json()

    if (!message) {
      return NextResponse.json({ success: false, error: '消息不能为空' }, { status: 400 })
    }

    const systemPrompt = `你是 NexFab AI CRM 智能助手，专注于外贸领域。你能够帮助用户进行客户分析、回复草拟、价格建议和市场洞察。
请用与用户消息相同的语言回复。保持专业、简洁、实用的回答风格。`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: context ? `[上下文信息]: ${context}\n\n[用户问题]: ${message}` : message },
    ]

    const result = await LLM.chat({ messages })
    const reply = typeof result === 'string' ? result : (result as { content?: string; text?: string; message?: string; choices?: Array<{ message?: { content?: string } }> }).content || (result as { text?: string }).text || (result as { message?: string }).message || JSON.stringify(result)

    return NextResponse.json({ success: true, data: { content: reply } })
  } catch (error) {
    console.error('AI Chat error:', error)
    return NextResponse.json({ success: false, error: 'AI回复生成失败' }, { status: 500 })
  }
}
