import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getAiConfig } from '@/lib/ai-settings'
import { buildCrmContext, callLlm, localFallbackReply, type ChatMessage } from '@/lib/agent-llm'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/agent/chat
 * Body: { conversationId?: string, message: string }
 *
 * 流程：保存用户消息 → 构建 CRM 上下文（数据权限同任务 38）→ 调用 LLM（未配置则本地降级）→ 保存助手回复
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const user = auth.user

  let body: { conversationId?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  const message = (body.message || '').trim()
  if (!message) {
    return NextResponse.json({ success: false, error: '消息不能为空' }, { status: 400 })
  }
  if (message.length > 4000) {
    return NextResponse.json({ success: false, error: '消息过长（上限 4000 字符）' }, { status: 400 })
  }

  try {
    // 1. 定位或创建对话（仅本人）
    let conversation
    if (body.conversationId) {
      conversation = await db.agentConversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
      })
      if (!conversation) {
        return NextResponse.json({ success: false, error: '对话不存在' }, { status: 404 })
      }
    } else {
      conversation = await db.agentConversation.create({
        data: { title: message.slice(0, 24), userId: user.id },
      })
    }

    // 2. 保存用户消息
    const userMessage = await db.agentMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: message },
    })

    // 3. 取最近 20 条消息作为对话历史
    const history = await db.agentMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 21, // 含刚插入的这条
    })
    history.reverse()
    const chatHistory: ChatMessage[] = history
      .slice(-20)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // 4. 构建 CRM 上下文并生成回复
    const systemPrompt = await buildCrmContext(user)
    const config = await getAiConfig()
    let mode: 'llm' | 'local' = 'local'
    let reply: string | null = null

    if (config.configured) {
      reply = await callLlm(chatHistory, systemPrompt, config)
      if (reply) mode = 'llm'
    }
    if (!reply) {
      reply = localFallbackReply(message, systemPrompt)
    }

    // 5. 保存助手回复
    const assistantMessage = await db.agentMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: reply },
    })

    // 6. 更新对话时间戳（首条消息时标题已设，无需重复）
    await db.agentConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        title: conversation.title,
        mode,
        userMessage,
        assistantMessage,
      },
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json({ success: false, error: '对话服务异常，请稍后重试' }, { status: 500 })
  }
}
