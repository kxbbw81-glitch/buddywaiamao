'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpenText, BrainCircuit, FileSearch, RefreshCw, Sparkles } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { AgentKnowledge, AgentKnowledgeSearchResult, AgentSkill, AgentSkillMatchResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type Mode = 'skills' | 'knowledge'

const skillDestinations: Record<string, ActivePage> = {
  consultation: { moduleId: 'aihub', moduleName: 'AI Agent', subName: 'Agent 对话' },
  'customer-lifecycle': { moduleId: 'customer', moduleName: '客户管理', subName: '客户档案' },
  outreach: { moduleId: 'comms', moduleName: '沟通中心', subName: '邮件管理' },
  prospecting: { moduleId: 'acquisition', moduleName: '获客中心', subName: '线索池' },
  'system-overview': { moduleId: 'dashboard', moduleName: '工作台', subName: '角色工作台' },
  'trade-documents': { moduleId: 'fulfillment', moduleName: '订单履约', subName: '单证管理' },
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  if (error instanceof Error) return error.message
  return '请求失败，请检查后端服务。'
}

function modeFor(active: ActivePage): Mode {
  return active.subName === '自定义 Skills' ? 'skills' : 'knowledge'
}

function libraryTitle(active: ActivePage, mode: Mode) {
  if (mode === 'skills') return '自定义 Skills'
  return active.subName === '销售打法' ? 'Agent 学习中心' : '业务记忆'
}

export function AgentLibraryView({ active, onNavigate }: { active: ActivePage; onNavigate: (target: ActivePage) => void }) {
  const mode = modeFor(active)
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [knowledge, setKnowledge] = useState<AgentKnowledge[]>([])
  const [skillGoal, setSkillGoal] = useState('')
  const [knowledgeQuery, setKnowledgeQuery] = useState('')
  const [skillMatch, setSkillMatch] = useState<AgentSkillMatchResult | null>(null)
  const [knowledgeResult, setKnowledgeResult] = useState<AgentKnowledgeSearchResult | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<AgentSkill | null>(null)
  const [selectedKnowledge, setSelectedKnowledge] = useState<AgentKnowledge | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setNotice('')
    try {
      if (mode === 'skills') {
        const result = await api.agentSkills('pageSize=20')
        setSkills(result.items)
      } else {
        const result = await api.agentKnowledge('pageSize=20')
        setKnowledge(result.items)
      }
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => { void refresh() }, [refresh])

  async function selectSkill(id: string) {
    setLoading(true)
    try {
      setSelectedSkill(await api.agentSkill(id))
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  async function selectKnowledge(id: string) {
    setLoading(true)
    try {
      setSelectedKnowledge(await api.agentKnowledgeDetail(id))
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  async function matchSkills() {
    const goal = skillGoal.trim()
    if (!goal) { setNotice('请输入要完成的业务目标。'); return }
    setLoading(true)
    try {
      setSkillMatch(await api.matchAgentSkills({ goal, activeModule: active.moduleId }))
      setNotice('已生成基于现有 V2.0 能力的匹配诊断。')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  async function searchKnowledge() {
    const query = knowledgeQuery.trim()
    if (!query) { setNotice('请输入要检索的问题。'); return }
    setLoading(true)
    try {
      setKnowledgeResult(await api.searchAgentKnowledge({ query, activeModule: active.moduleId }))
      setNotice('已检索导入的经营知识并返回可追溯来源。')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'skills') return (
    <div className="space-y-5" data-testid="agent-library-skills-view">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        <Sparkles className="h-4 w-4 text-violet-700" />
        <span className="flex-1"><b>{libraryTitle(active, mode)}</b> · 已迁入 6 个 Agent Skill，匹配结果只引导现有 V2.0 页面与接口。</span>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
      </div>
      {notice ? <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs text-slate-600">{notice}</div> : null}
      <Card>
        <CardHeader><CardTitle>目标匹配诊断</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <textarea className={textareaClass} maxLength={1000} value={skillGoal} onChange={(event) => setSkillGoal(event.target.value)} placeholder="例如：搜索德国采购商，整理候选线索并准备人工复核" />
          <Button onClick={() => void matchSkills()} disabled={loading}><BrainCircuit className="h-4 w-4" />匹配 Skills</Button>
          {skillMatch ? <div className="space-y-2">{skillMatch.matches.map((item) => <div key={item.skill.id} className="border-b border-slate-100 pb-2 text-xs last:border-0"><div className="flex flex-wrap items-center gap-2"><b>{item.skill.name}</b><Badge tone="purple">{item.matchScore}</Badge></div><div className="mt-1 text-slate-500">{item.matchReasons.join('；') || '基础匹配'}</div></div>)}</div> : null}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">{skills.map((skill) => <Card key={skill.id}><CardHeader><CardTitle className="flex items-center gap-2"><span>{skill.name}</span><Badge tone={skill.status === 'active' ? 'blue' : 'amber'}>{skill.status}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5"><p className="m-0 text-slate-600">{skill.description}</p><div className="flex flex-wrap gap-1">{skill.modules.map((module) => <Badge key={module}>{module}</Badge>)}</div><Button variant="secondary" size="sm" onClick={() => void selectSkill(skill.id)} disabled={loading}>查看执行边界</Button></CardContent></Card>)}</div>
      {selectedSkill ? <Card><CardHeader><CardTitle>{selectedSkill.name} · 执行边界</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-6"><div className="whitespace-pre-wrap text-slate-700">{selectedSkill.instructions}</div><div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-slate-500"><span className="flex-1">工具引用：{selectedSkill.toolRefs.join('、') || '无'}。该库不自动执行写入、发送或外部调用。</span>{skillDestinations[selectedSkill.id] ? <Button variant="secondary" size="sm" onClick={() => onNavigate(skillDestinations[selectedSkill.id])}>打开对应 V2.0 页面</Button> : null}</div></CardContent></Card> : null}
    </div>
  )

  return (
    <div className="space-y-5" data-testid="agent-library-knowledge-view">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <BookOpenText className="h-4 w-4 text-brand" />
        <span className="flex-1"><b>{libraryTitle(active, mode)}</b> · 已迁入 10 份经营知识，检索只返回来源文本，不生成未验证结论。</span>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
      </div>
      {notice ? <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs text-slate-600">{notice}</div> : null}
      <Card>
        <CardHeader><CardTitle>资料问答</CardTitle></CardHeader>
        <CardContent className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><input className={inputClass} maxLength={1000} value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} placeholder="例如：开发信只写草稿时有什么边界？" /><Button onClick={() => void searchKnowledge()} disabled={loading}><FileSearch className="h-4 w-4" />检索</Button></div>{knowledgeResult ? <div className="space-y-3 rounded-lg border border-line bg-slate-50 p-3 text-xs leading-6"><Badge tone={knowledgeResult.status === 'ANSWERED_WITH_SOURCES' ? 'blue' : 'amber'}>{knowledgeResult.status}</Badge><div className="whitespace-pre-wrap text-slate-700">{knowledgeResult.answer}</div><div className="text-slate-500">来源：{knowledgeResult.sources.map((item) => item.title).join('；') || '无'}。</div></div> : null}</CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">{knowledge.map((item) => <Card key={item.id}><CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><span>{item.title}</span><Badge>{item.kind}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5"><p className="m-0 text-slate-600">{item.summary}</p><div className="flex flex-wrap gap-1">{item.keywords.slice(0, 5).map((keyword) => <Badge key={keyword}>{keyword}</Badge>)}</div><Button variant="secondary" size="sm" onClick={() => void selectKnowledge(item.id)} disabled={loading}>查看原文与边界</Button></CardContent></Card>)}</div>
      {selectedKnowledge ? <Card><CardHeader><CardTitle>{selectedKnowledge.title} · {selectedKnowledge.version}</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-6"><div className="whitespace-pre-wrap text-slate-700">{selectedKnowledge.content}</div><div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2"><div><b>完成标准</b><div className="text-slate-500">{selectedKnowledge.successCriteria?.join('；') || '—'}</div></div><div><b>避免事项</b><div className="text-slate-500">{selectedKnowledge.failureCases?.join('；') || '—'}</div></div></div></CardContent></Card> : null}
    </div>
  )
}
