import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ensureSkillsSeeded } from '@/lib/agent-skills-seed'
import { NextRequest, NextResponse } from 'next/server'

/** GET /api/agent/skills — 全部分类（含 skills），首次访问自动播种 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  await ensureSkillsSeeded()

  const categories = await db.agentSkillCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { skills: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json({
    success: true,
    data: categories.map((c) => ({
      key: c.key,
      name: c.name,
      icon: c.icon,
      builtin: c.builtin,
      desc: c.desc,
      items: c.skills.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        src: s.src,
        on: s.on,
        desc: s.desc,
        params: s.params,
      })),
    })),
  })
}

/** POST /api/agent/skills — 新建自定义 skill */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: { categoryKey?: string; name?: string; icon?: string; desc?: string; params?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  const desc = (body.desc || '').trim()
  if (!name || !desc) {
    return NextResponse.json({ success: false, error: '名称与说明不能为空' }, { status: 400 })
  }

  let params = (body.params || '').trim() || '{}'
  try {
    JSON.parse(params)
  } catch {
    return NextResponse.json({ success: false, error: '参数必须是合法 JSON' }, { status: 400 })
  }

  const category = await db.agentSkillCategory.findUnique({ where: { key: body.categoryKey || '' } })
  if (!category) {
    return NextResponse.json({ success: false, error: '所属分类不存在' }, { status: 404 })
  }

  const count = await db.agentSkill.count({ where: { categoryId: category.id } })
  const skill = await db.agentSkill.create({
    data: {
      categoryId: category.id,
      name,
      icon: (body.icon || '').trim() || '⚡',
      src: 'custom',
      on: true,
      desc,
      params,
      sortOrder: count,
    },
  })

  return NextResponse.json({ success: true, data: skill }, { status: 201 })
}

/** PATCH /api/agent/skills — 更新 skill（启停/编辑） */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: { id?: string; on?: boolean; name?: string; icon?: string; desc?: string; params?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ success: false, error: '缺少 skill id' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.on !== undefined) patch.on = body.on
  if (body.name !== undefined) patch.name = body.name.trim()
  if (body.icon !== undefined) patch.icon = body.icon.trim() || '⚡'
  if (body.desc !== undefined) patch.desc = body.desc.trim()
  if (body.params !== undefined) {
    try {
      JSON.parse(body.params)
      patch.params = body.params
    } catch {
      return NextResponse.json({ success: false, error: '参数必须是合法 JSON' }, { status: 400 })
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: '无更新内容' }, { status: 400 })
  }

  const skill = await db.agentSkill.update({ where: { id: body.id }, data: patch })
  return NextResponse.json({ success: true, data: skill })
}

/** DELETE /api/agent/skills?id=... — 删除自定义 skill（内置不可删） */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: '缺少 skill id' }, { status: 400 })
  }

  const skill = await db.agentSkill.findUnique({ where: { id } })
  if (!skill) {
    return NextResponse.json({ success: false, error: 'skill 不存在' }, { status: 404 })
  }
  if (skill.src === 'builtin') {
    return NextResponse.json({ success: false, error: '内置 skill 不可删除' }, { status: 403 })
  }

  await db.agentSkill.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
