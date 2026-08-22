import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/** GET /api/agent/conversations/[id] — 对话详情（含全部消息，仅本人） */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params

  const conversation = await db.agentConversation.findFirst({
    where: { id, userId: auth.user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!conversation) {
    return NextResponse.json({ success: false, error: '对话不存在' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: conversation })
}

/** DELETE /api/agent/conversations/[id] — 删除对话（仅本人） */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params

  const conversation = await db.agentConversation.findFirst({
    where: { id, userId: auth.user.id },
  })
  if (!conversation) {
    return NextResponse.json({ success: false, error: '对话不存在' }, { status: 404 })
  }

  await db.agentConversation.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
