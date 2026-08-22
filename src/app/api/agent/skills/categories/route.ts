import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/** POST /api/agent/skills/categories — 新建自定义分类 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: { name?: string; icon?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  if (!name) {
    return NextResponse.json({ success: false, error: '分类名称不能为空' }, { status: 400 })
  }

  const exists = await db.agentSkillCategory.findFirst({ where: { name } })
  if (exists) {
    return NextResponse.json({ success: false, error: '已存在同名分类' }, { status: 409 })
  }

  const count = await db.agentSkillCategory.count()
  const category = await db.agentSkillCategory.create({
    data: {
      key: `cat-${crypto.randomBytes(4).toString('hex')}`,
      name,
      icon: (body.icon || '').trim() || '🗂️',
      builtin: false,
      desc: '自定义分类：按团队实际业务场景归集 skills。',
      sortOrder: count,
    },
  })

  return NextResponse.json({ success: true, data: category }, { status: 201 })
}

/** PATCH /api/agent/skills/categories — 重命名分类（预置分类也可改名） */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: { key?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  if (!body.key || !name) {
    return NextResponse.json({ success: false, error: '缺少分类 key 或新名称' }, { status: 400 })
  }

  const dup = await db.agentSkillCategory.findFirst({ where: { name, NOT: { key: body.key } } })
  if (dup) {
    return NextResponse.json({ success: false, error: '已存在同名分类' }, { status: 409 })
  }

  const category = await db.agentSkillCategory.update({
    where: { key: body.key },
    data: { name },
  })
  return NextResponse.json({ success: true, data: category })
}

/** DELETE /api/agent/skills/categories?key=... — 删除自定义分类（含其下 skills；预置不可删） */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const key = new URL(request.url).searchParams.get('key')
  if (!key) {
    return NextResponse.json({ success: false, error: '缺少分类 key' }, { status: 400 })
  }

  const category = await db.agentSkillCategory.findUnique({
    where: { key },
    include: { _count: { select: { skills: true } } },
  })
  if (!category) {
    return NextResponse.json({ success: false, error: '分类不存在' }, { status: 404 })
  }
  if (category.builtin) {
    return NextResponse.json({ success: false, error: '预置分类不可删除' }, { status: 403 })
  }

  const skillCount = category._count.skills
  await db.agentSkillCategory.delete({ where: { key } })
  return NextResponse.json({ success: true, data: { deletedSkills: skillCount } })
}
