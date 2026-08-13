import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quotation = await db.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true, companyNameEn: true, country: true } },
        creator: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        inquiry: { select: { inquiryNo: true, subject: true } },
        items: { include: { product: { select: { productCode: true } } } },
        orders: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!quotation) {
      return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: quotation })
  } catch (error) {
    console.error('Quotation GET error:', error)
    return NextResponse.json({ success: false, error: '获取报价详情失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.tradeTerm !== undefined) updateData.tradeTerm = body.tradeTerm
    if (body.currency !== undefined) updateData.currency = body.currency
    if (body.exchangeRate !== undefined) updateData.exchangeRate = body.exchangeRate
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.marginCheckPassed !== undefined) updateData.marginCheckPassed = body.marginCheckPassed
    if (body.marginCheckReason !== undefined) updateData.marginCheckReason = body.marginCheckReason
    if (body.approvedBy !== undefined) {
      updateData.approvedBy = body.approvedBy
      updateData.approvedAt = body.approvedBy ? new Date() : null
    }
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount
    if (body.totalCost !== undefined) updateData.totalCost = body.totalCost
    if (body.profitRate !== undefined) updateData.profitRate = body.profitRate

    const quotation = await db.quotation.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: quotation })
  } catch (error) {
    console.error('Quotation PUT error:', error)
    return NextResponse.json({ success: false, error: '更新报价失败' }, { status: 500 })
  }
}
