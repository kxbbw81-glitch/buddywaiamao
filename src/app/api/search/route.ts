import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const MAX_RESULTS_PER_CATEGORY = 5

function escapeForLike(str: string) {
  return str.replace(/[%_\\]/g, '\\$&')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 1) {
      return NextResponse.json({
        success: true,
        data: { customers: [], inquiries: [], quotations: [], orders: [] },
      })
    }

    const keyword = `%${escapeForLike(q)}%`

    // Search customers: companyName, companyNameEn, country
    const customers = await db.customer.findMany({
      where: {
        OR: [
          { companyName: { contains: q } },
          { companyNameEn: { contains: q } },
          { country: { contains: q } },
        ],
      },
      select: {
        id: true,
        companyName: true,
        companyNameEn: true,
        country: true,
        customerLevel: true,
      },
      take: MAX_RESULTS_PER_CATEGORY,
    })

    // Search inquiries: inquiryNo, subject
    const inquiries = await db.inquiry.findMany({
      where: {
        OR: [
          { inquiryNo: { contains: q } },
          { subject: { contains: q } },
        ],
      },
      select: {
        id: true,
        inquiryNo: true,
        subject: true,
        status: true,
        priority: true,
        customer: {
          select: { companyName: true },
        },
      },
      take: MAX_RESULTS_PER_CATEGORY,
    })

    // Search quotations: quoteNo
    const quotations = await db.quotation.findMany({
      where: {
        quoteNo: { contains: q },
      },
      select: {
        id: true,
        quoteNo: true,
        totalAmount: true,
        status: true,
        currency: true,
        customer: {
          select: { companyName: true },
        },
      },
      take: MAX_RESULTS_PER_CATEGORY,
    })

    // Search orders: orderNo
    const orders = await db.order.findMany({
      where: {
        orderNo: { contains: q },
      },
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        status: true,
        currency: true,
        customer: {
          select: { companyName: true },
        },
      },
      take: MAX_RESULTS_PER_CATEGORY,
    })

    // Format results
    const customerResults = customers.map((c) => ({
      id: c.id,
      type: 'customer' as const,
      text: c.companyName,
      subtitle: c.country || c.customerLevel ? `${c.customerLevel}级${c.country ? ' · ' + c.country : ''}` : '',
    }))

    const inquiryResults = inquiries.map((i) => ({
      id: i.id,
      type: 'inquiry' as const,
      text: i.subject || i.inquiryNo,
      subtitle: `${i.inquiryNo}${i.customer ? ' · ' + i.customer.companyName : ''}`,
    }))

    const quotationResults = quotations.map((qt) => ({
      id: qt.id,
      type: 'quotation' as const,
      text: qt.quoteNo,
      subtitle: `${qt.currency} ${qt.totalAmount.toLocaleString()}${qt.customer ? ' · ' + qt.customer.companyName : ''}`,
    }))

    const orderResults = orders.map((o) => ({
      id: o.id,
      type: 'order' as const,
      text: o.orderNo,
      subtitle: `${o.currency} ${o.totalAmount.toLocaleString()}${o.customer ? ' · ' + o.customer.companyName : ''}`,
    }))

    return NextResponse.json({
      success: true,
      data: {
        customers: customerResults,
        inquiries: inquiryResults,
        quotations: quotationResults,
        orders: orderResults,
      },
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { success: false, error: '搜索失败，请稍后重试' },
      { status: 500 }
    )
  }
}
