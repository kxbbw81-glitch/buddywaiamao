import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sampleScopeWhere } from '@/lib/commercial-access'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const sample = await db.sample.findFirst({
      where: { id, ...sampleScopeWhere(auth.user) },
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        inquiry: { select: { id: true, inquiryNo: true, subject: true } },
      },
    })
    if (!sample) return NextResponse.json({ success: false, error: '样品不存在或无权访问' }, { status: 404 })
    return NextResponse.json({ success: true, data: sample })
  } catch (error) {
    console.error('Sample GET by ID error:', error)
    return NextResponse.json({ success: false, error: '获取样品详情失败' }, { status: 500 })
  }
}
