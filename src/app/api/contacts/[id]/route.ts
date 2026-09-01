'use server'

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { customerScopeWhere, requireAuth } from '@/lib/auth'
import { prepareEncryptedContactPatch, revealEncryptedContact } from '@/lib/contact-pii'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    const { id } = await params
    const contact = await db.contact.findUnique({
      where: { id },
      include: { customer: { select: { companyName: true } } },
    })
    if (!contact) {
      return NextResponse.json({ success: false, error: '联系人不存在' }, { status: 404 })
    }
    const customer = await db.customer.findFirst({ where: { id: contact.customerId, ...customerScopeWhere(auth.user) }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: false, error: '无权访问联系人' }, { status: 403 })
    return NextResponse.json({ success: true, data: revealEncryptedContact(contact) })
  } catch (error) {
    console.error('GET /api/contacts/[id] error:', error)
    return NextResponse.json({ success: false, error: '获取联系人失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    const { id } = await params
    const existing = await db.contact.findUnique({ where: { id }, select: { customerId: true } })
    if (!existing) return NextResponse.json({ success: false, error: '联系人不存在' }, { status: 404 })
    const customer = await db.customer.findFirst({ where: { id: existing.customerId, ...customerScopeWhere(auth.user) }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: false, error: '无权修改联系人' }, { status: 403 })
    const body = await request.json()
    const contact = await db.contact.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.position ? { position: body.position } : {}),
        ...prepareEncryptedContactPatch({
          ...(Object.prototype.hasOwnProperty.call(body, 'email') ? { email: body.email } : {}),
          ...(Object.prototype.hasOwnProperty.call(body, 'phone') ? { phone: body.phone } : {}),
          ...(Object.prototype.hasOwnProperty.call(body, 'whatsapp') ? { whatsapp: body.whatsapp } : {}),
        }),
        ...(typeof body.isDecisionMaker === 'boolean' ? { isDecisionMaker: body.isDecisionMaker } : {}),
      },
    })
    return NextResponse.json({ success: true, data: revealEncryptedContact(contact) })
  } catch (error) {
    console.error('PUT /api/contacts/[id] error:', error)
    return NextResponse.json({ success: false, error: '更新联系人失败' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    const { id } = await params
    const existing = await db.contact.findUnique({ where: { id }, select: { customerId: true } })
    if (!existing) return NextResponse.json({ success: false, error: '联系人不存在' }, { status: 404 })
    const customer = await db.customer.findFirst({ where: { id: existing.customerId, ...customerScopeWhere(auth.user) }, select: { id: true } })
    if (!customer) return NextResponse.json({ success: false, error: '无权删除联系人' }, { status: 403 })
    await db.contact.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/contacts/[id] error:', error)
    return NextResponse.json({ success: false, error: '删除联系人失败' }, { status: 500 })
  }
}
