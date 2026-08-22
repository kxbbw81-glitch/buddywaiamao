import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'

const DOC_TYPES = new Set(['TDS', 'SDS', 'CERT'])
const DOC_STATUSES = new Set(['DRAFT', 'REVIEWED', 'EXPIRED'])

/**
 * GET /api/products/[id]/docs — 产品文档列表（TDS/SDS/CERT）
 * POST /api/products/[id]/docs — 新建产品文档（仅管理角色）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100)
    const where = { productId: id }
    const [items, total] = await Promise.all([
      db.productDoc.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.productDoc.count({ where }),
    ])
    return NextResponse.json({ success: true, data: items, total, page, pageSize })
  } catch (error) {
    console.error('ProductDoc GET error:', error)
    return NextResponse.json({ success: false, error: '获取产品文档失败' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ success: false, error: '产品不存在' }, { status: 404 })

    const body = await request.json()
    const type = (body.type || '').toUpperCase()
    const status = (body.status || '').toUpperCase()
    if (!DOC_TYPES.has(type) || !DOC_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: '资料类型(TDS/SDS/CERT)或状态(DRAFT/REVIEWED/EXPIRED)不支持' }, { status: 400 })
    }
    if (!body.fileUrl) {
      return NextResponse.json({ success: false, error: 'fileUrl 必填' }, { status: 400 })
    }
    let validUntil: Date | null = null
    if (body.validUntil) {
      validUntil = new Date(body.validUntil)
      if (isNaN(validUntil.getTime())) {
        return NextResponse.json({ success: false, error: '有效期格式无效' }, { status: 400 })
      }
    }
    const doc = await db.productDoc.create({
      data: { productId: id, type, status, fileUrl: body.fileUrl, validUntil },
    })
    return NextResponse.json({ success: true, data: doc }, { status: 201 })
  } catch (error) {
    console.error('ProductDoc POST error:', error)
    return NextResponse.json({ success: false, error: '创建产品文档失败' }, { status: 500 })
  }
}
