import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/** GET /api/agent/conversations — 当前用户的对话列表 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const conversations = await db.agentConversation.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true },
      },
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      lastPreview: c.messages[0]?.content?.slice(0, 60) || '',
    })),
  })
}

/** POST /api/agent/conversations — 新建对话 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let title = '新对话'
  try {
    const body = await request.json()
    if (body?.title && typeof body.title === 'string') title = body.title.slice(0, 50)
  } catch {
    // 空请求体也允许，用默认标题
  }

  const conversation = await db.agentConversation.create({
    data: { title, userId: auth.user.id },
  })

  return NextResponse.json({ success: true, data: conversation }, { status: 201 })
}
