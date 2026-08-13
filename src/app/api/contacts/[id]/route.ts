'use server'

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  { params }: { params: { id: string } },
) {
  try {
    const contact = await db.contact.findUnique({
      where: { id: params.id },
      include: { customer: { select: { companyName: true } } },
    })
    if (!contact) {
      return NextResponse.json({ success: false, error: '联系人不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('GET /api/contacts/[id] error:', error)
    return NextResponse.json({ success: false, error: '获取联系人失败' }, { status: 500 })
  }
}

export async function PUT(
  { params }: { params: { id: string } },
  request: Request,
) {
  try {
    const body = await request.json()
    const contact = await db.contact.update({
      where: { id: params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.position ? { position: body.position } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.whatsapp ? { whatsapp: body.whatsapp } : {}),
        ...(typeof body.isDecisionMaker === 'boolean' ? { isDecisionMaker: body.isDecisionMaker } : {}),
      },
    })
    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('PUT /api/contacts/[id] error:', error)
    return NextResponse.json({ success: false, error: '更新联系人失败' }, { status: 500 })
  }
}

export async function DELETE(
  { params }: { params: { id: string } },
) {
  try {
    await db.contact.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/contacts/[id] error:', error)
    return NextResponse.json({ success: false, error: '删除联系人失败' }, { status: 500 })
  }
}
