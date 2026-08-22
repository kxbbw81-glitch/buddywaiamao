import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/quotations/[id]/versions — 报价版本历史（按版本号倒序）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const quote = await db.quotation.findUnique({ where: { id }, select: { id: true } })
    if (!quote) {
      return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 })
    }
    const versions = await db.quoteVersion.findMany({
      where: { quotationId: id },
      orderBy: { version: 'desc' },
    })
    return NextResponse.json({ success: true, data: versions })
  } catch (error) {
    console.error('Quote versions error:', error)
    return NextResponse.json({ success: false, error: '获取版本历史失败' }, { status: 500 })
  }
}
