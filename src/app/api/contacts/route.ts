import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/contacts?customerId=xxx — 联系人列表（按客户筛选）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const where: Record<string, unknown> = {}
    if (customerId) where.customerId = customerId
    const contacts = await db.contact.findMany({ where, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ success: true, data: contacts })
  } catch (error) {
    console.error('Contacts GET error:', error)
    return NextResponse.json({ success: false, error: '获取联系人失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, name, position, email, phone, whatsapp, isDecisionMaker } = body

    if (!customerId || !name?.trim()) {
      return NextResponse.json({ success: false, error: '客户ID和姓名为必填项' }, { status: 400 })
    }

    const contact = await db.contact.create({
      data: {
        customerId,
        name: name.trim(),
        position: position?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        isDecisionMaker: !!isDecisionMaker,
      },
    })

    return NextResponse.json({ success: true, data: contact }, { status: 201 })
  } catch (error) {
    console.error('Contact POST error:', error)
    return NextResponse.json({ success: false, error: '创建联系人失败' }, { status: 500 })
  }
}
