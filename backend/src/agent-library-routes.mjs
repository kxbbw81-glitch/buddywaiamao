import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertRagAccess } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const libraryDir = join(moduleDir, '..', 'agent-library')
let libraryCache = null

function normalized(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN')
}

function termsFor(value) {
  const source = normalized(value)
  const terms = new Set(source.match(/[a-z0-9][a-z0-9_.-]+|[\p{Script=Han}]{2,}/gu) || [])
  for (const group of source.match(/[\p{Script=Han}]{2,}/gu) || []) {
    for (let index = 0; index < group.length - 1; index += 1) terms.add(group.slice(index, index + 2))
  }
  return terms
}

function requiredString(value, field, max) {
  return text(value, field, { required: true, max })
}

function asStringArray(value, field, max = 100) {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${field} 格式无效。`)
  }
  return value.map((item) => item.trim())
}

function readJsonFile(pathname) {
  return JSON.parse(readFileSync(pathname, 'utf8'))
}

function loadLibrary() {
  if (libraryCache) return libraryCache
  const skills = []
  const knowledge = []
  const errors = []
  const skillsDir = join(libraryDir, 'agent-skills')
  const knowledgeDir = join(libraryDir, 'agent-knowledge')

  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      try {
        const directory = join(skillsDir, entry.name)
        const manifest = readJsonFile(join(directory, 'skill.json'))
        const instructions = readFileSync(join(directory, 'SKILL.md'), 'utf8').trim()
        const skill = {
          id: requiredString(manifest.id, 'Skill ID', 80),
          name: requiredString(manifest.name, 'Skill 名称', 120),
          version: requiredString(manifest.version, 'Skill 版本', 40),
          category: requiredString(manifest.category, 'Skill 分类', 60),
          description: requiredString(manifest.description, 'Skill 描述', 500),
          status: ['active', 'draft', 'archived'].includes(manifest.status) ? manifest.status : 'draft',
          priority: Number.isInteger(manifest.priority) ? Math.max(0, Math.min(1000, manifest.priority)) : 50,
          triggers: asStringArray(manifest.triggers || [], 'Skill triggers', 50),
          keywords: asStringArray(manifest.keywords || [], 'Skill keywords', 100),
          modules: asStringArray(manifest.modules || [], 'Skill modules', 50),
          toolRefs: asStringArray(manifest.toolRefs || [], 'Skill toolRefs', 100),
          instructions: instructions.slice(0, 8000),
        }
        if (!skill.instructions) throw new Error('Skill 指令为空。')
        skills.push(skill)
      } catch (error) {
        errors.push(`skill/${entry.name}: ${error instanceof Error ? error.message : '读取失败'}`)
      }
    }
  }

  if (existsSync(knowledgeDir)) {
    for (const entry of readdirSync(knowledgeDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      try {
        const item = readJsonFile(join(knowledgeDir, entry.name))
        knowledge.push({
          id: requiredString(item.id, '知识 ID', 160),
          kind: requiredString(item.kind, '知识类型', 80),
          module: requiredString(item.module, '知识模块', 80),
          title: requiredString(item.title, '知识标题', 160),
          summary: requiredString(item.summary, '知识摘要', 500),
          content: requiredString(item.content, '知识正文', 8000),
          keywords: asStringArray(item.keywords || [], '知识 keywords', 40),
          roles: asStringArray(item.roles || [], '知识 roles', 10),
          toolRefs: asStringArray(item.toolRefs || [], '知识 toolRefs', 40),
          successCriteria: asStringArray(item.successCriteria || [], '知识 successCriteria', 20),
          failureCases: asStringArray(item.failureCases || [], '知识 failureCases', 20),
          version: requiredString(item.version, '知识版本', 40),
          sourceFile: entry.name,
        })
      } catch (error) {
        errors.push(`knowledge/${entry.name}: ${error instanceof Error ? error.message : '读取失败'}`)
      }
    }
  }

  libraryCache = {
    skills: skills.sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name, 'zh-CN')),
    knowledge: knowledge.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN')),
    errors,
  }
  return libraryCache
}

function publicSkill(skill, detail = false) {
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    category: skill.category,
    description: skill.description,
    status: skill.status,
    priority: skill.priority,
    triggers: skill.triggers,
    keywords: skill.keywords,
    modules: skill.modules,
    toolRefs: skill.toolRefs,
    instructionLength: skill.instructions.length,
    executionMode: 'GUIDED_EXISTING_API_ONLY',
    ...(detail ? { instructions: skill.instructions } : {}),
  }
}

function publicKnowledge(item, detail = false) {
  return {
    id: item.id,
    kind: item.kind,
    module: item.module,
    title: item.title,
    summary: item.summary,
    keywords: item.keywords,
    roles: item.roles,
    toolRefs: item.toolRefs,
    version: item.version,
    source: 'IMPORTED_AGENT_KNOWLEDGE',
    ...(detail ? { content: item.content, successCriteria: item.successCriteria, failureCases: item.failureCases } : {}),
  }
}

function pagination(items, url) {
  const { page, pageSize, skip } = listQuery(url)
  return { items: items.slice(skip, skip + pageSize), page, pageSize, total: items.length }
}

function textScore(query, candidate) {
  const queryTerms = termsFor(query)
  if (!queryTerms.size) return 0
  const candidateTerms = termsFor(candidate)
  let matches = 0
  for (const term of queryTerms) if (candidateTerms.has(term)) matches += 1
  return matches / Math.max(1, Math.min(queryTerms.size, candidateTerms.size))
}

function rankSkills(goal, activeModule) {
  const { skills } = loadLibrary()
  const goalText = normalized(goal)
  const system = skills.find((item) => item.id === 'system-overview')
  const ranked = skills.filter((item) => item.id !== 'system-overview' && item.status === 'active').map((skill) => {
    const reasons = []
    let score = skill.priority / 100
    for (const trigger of skill.triggers) {
      if (goalText.includes(normalized(trigger))) { score += 12; reasons.push(`触发语：${trigger}`) }
    }
    for (const keyword of skill.keywords) {
      if (goalText.includes(normalized(keyword))) { score += 4; reasons.push(`关键词：${keyword}`) }
    }
    const overlap = textScore(goalText, [skill.name, skill.category, skill.description, ...skill.keywords, ...skill.modules].join(' '))
    if (overlap >= 0.08) { score += Math.min(10, Math.round(overlap * 24)); reasons.push(`语义重合：${Math.round(overlap * 100)}%`) }
    if (activeModule && (skill.modules.includes(activeModule) || skill.modules.includes('all'))) { score += 3; reasons.push(`当前模块：${activeModule}`) }
    return { skill: publicSkill(skill), matchScore: Math.round(score), matchReasons: [...new Set(reasons)].slice(0, 6) }
  }).filter((item) => item.matchScore >= 4).sort((left, right) => right.matchScore - left.matchScore || right.skill.priority - left.skill.priority)
  const first = system ? [{ skill: publicSkill(system), matchScore: 100, matchReasons: ['系统基础 Skill'] }] : []
  return [...first, ...ranked].slice(0, 4)
}

function searchKnowledge(query, activeModule) {
  const queryText = normalized(query)
  const matches = loadLibrary().knowledge.map((item) => {
    let score = textScore(queryText, `${item.title} ${item.summary} ${item.content} ${item.keywords.join(' ')}`)
    if (activeModule && item.module === activeModule) score += 0.05
    return { item, score }
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title, 'zh-CN')).slice(0, 5)
  if (!matches.length) return {
    status: 'INSUFFICIENT_CONTEXT',
    answer: '导入的 Agent 知识中暂未找到相关信息；系统不会据此生成未验证的业务结论。',
    sources: [],
    limitations: ['仅检索当前导入的经营知识文件。', '不会自动执行写入、发送或外部调用。'],
  }
  return {
    status: 'ANSWERED_WITH_SOURCES',
    answer: matches.map(({ item }) => `${item.title}：${item.content.split(/(?<=[。！？.!?])\s*/u).find(Boolean) || item.summary}`).join('\n'),
    sources: matches.map(({ item, score }) => ({ id: item.id, title: item.title, module: item.module, version: item.version, score: Math.round(score * 100) })),
    limitations: ['答案仅由导入知识原文片段组成。', '对外承诺、发送和正式业务写入仍需使用现有 V2.0 流程并人工确认。'],
  }
}

function pathId(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null
  const raw = pathname.slice(prefix.length)
  if (!raw || raw.includes('/')) return null
  try { return decodeURIComponent(raw) } catch { throw new HttpError(400, 'VALIDATION_ERROR', '资源 ID 编码无效。') }
}

export async function handleAgentLibraryRoute({ req, res, url, pathname, actor }) {
  if (!pathname.startsWith('/api/agent-library/')) return false
  assertRagAccess(actor)
  const library = loadLibrary()

  if (req.method === 'GET' && pathname === '/api/agent-library/skills') {
    const query = text(url.searchParams.get('q'), '搜索词', { max: 120 }) || ''
    const items = library.skills.filter((item) => !query || normalized(`${item.name} ${item.category} ${item.description} ${item.keywords.join(' ')}`).includes(normalized(query))).map((item) => publicSkill(item))
    return send(res, 200, { data: pagination(items, url) })
  }
  if (req.method === 'POST' && pathname === '/api/agent-library/skills/match') {
    const body = await readJson(req)
    const goal = text(body.goal, '目标', { required: true, max: 1000 })
    const activeModule = text(body.activeModule, '当前模块', { max: 80 }) || ''
    return send(res, 200, { data: { goalPreview: goal.slice(0, 160), matches: rankSkills(goal, activeModule), executionMode: 'GUIDED_EXISTING_API_ONLY', notice: '匹配结果仅用于选择现有 V2.0 页面和 API，不会自动写入、发送或调用外部工具。' } })
  }
  const skillId = pathId(pathname, '/api/agent-library/skills/')
  if (req.method === 'GET' && skillId) {
    const skill = library.skills.find((item) => item.id === skillId)
    if (!skill) throw new HttpError(404, 'NOT_FOUND', 'Agent Skill 不存在。')
    return send(res, 200, { data: publicSkill(skill, true) })
  }

  if (req.method === 'GET' && pathname === '/api/agent-library/knowledge') {
    const query = text(url.searchParams.get('q'), '搜索词', { max: 120 }) || ''
    const module = text(url.searchParams.get('module'), '模块', { max: 80 }) || ''
    const kind = text(url.searchParams.get('kind'), '知识类型', { max: 80 }) || ''
    // 修复说明：[低危-越权读]，原因：知识条目带 roles 限定但列表未按访问者角色过滤；现过滤（无 roles 限定视为全员可见）。
    const items = library.knowledge.filter((item) => (!query || normalized(`${item.title} ${item.summary} ${item.keywords.join(' ')}`).includes(normalized(query))) && (!module || item.module === module) && (!kind || item.kind === kind) && (!item.roles?.length || item.roles.map((r) => String(r).toUpperCase()).includes(actor.role))).map((item) => publicKnowledge(item))
    return send(res, 200, { data: pagination(items, url) })
  }
  if (req.method === 'POST' && pathname === '/api/agent-library/knowledge/search') {
    const body = await readJson(req)
    const query = text(body.query, '问题', { required: true, max: 1000 })
    const activeModule = text(body.activeModule, '当前模块', { max: 80 }) || ''
    return send(res, 200, { data: { queryPreview: query.slice(0, 160), ...searchKnowledge(query, activeModule) } })
  }
  const knowledgeId = pathId(pathname, '/api/agent-library/knowledge/')
  if (req.method === 'GET' && knowledgeId) {
    const item = library.knowledge.find((entry) => entry.id === knowledgeId)
    if (!item) throw new HttpError(404, 'NOT_FOUND', 'Agent 知识不存在。')
    return send(res, 200, { data: publicKnowledge(item, true) })
  }
  return false
}
