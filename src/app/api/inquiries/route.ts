import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const source = searchParams.get('source') || ''
    const assignedTo = searchParams.get('assignedTo') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { inquiryNo: { contains: search } },
        { subject: { contains: search } },
        { content: { contains: search } },
      ]
    }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (source) where.source = source
    if (assignedTo) where.assignedTo = assignedTo

    const inquiries = await db.inquiry.findMany({
      where,
      include: {
        customer: { select: { id: true, companyName: true, country: true, customerLevel: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { quotations: true, activities: true, samples: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const total = await db.inquiry.count({ where })

    return NextResponse.json({ success: true, data: inquiries, total, page, pageSize })
  } catch (error) {
    console.error('Inquiries GET error:', error)
    return NextResponse.json({ success: false, error: '获取询盘列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const count = await db.inquiry.count()
    const inquiryNo = `INQ-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
    const inquiry = await db.inquiry.create({
      data: {
        inquiryNo,
        customerId: body.customerId || null,
        source: body.source || 'email',
        subject: body.subject,
        content: body.content,
        language: body.language || 'en',
        priority: body.priority || 'normal',
        status: 'new',
      },
    })
    return NextResponse.json({ success: true, data: inquiry }, { status: 201 })
  } catch (error) {
    console.error('Inquiries POST error:', error)
    return NextResponse.json({ success: false, error: '创建询盘失败' }, { status: 500 })
  }
}
