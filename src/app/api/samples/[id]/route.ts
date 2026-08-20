import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sample = await db.sample.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        inquiry: { select: { id: true, inquiryNo: true, subject: true } },
      },
    })

    if (!sample) {
      return NextResponse.json({ success: false, error: '样品不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: sample })
  } catch (error) {
    console.error('Sample GET by ID error:', error)
    return NextResponse.json({ success: false, error: '获取样品详情失败' }, { status: 500 })
  }
}
