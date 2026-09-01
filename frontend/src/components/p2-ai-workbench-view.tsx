'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { AlertTriangle, CheckCircle2, CircleDollarSign, DatabaseZap, FileWarning, RefreshCw, SearchCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { AiCapabilityContract, AiGatewayStatus, AiTask, AiTaskEvent, RagResponse, ToolCall } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type NoticeTone = 'blue' | 'green' | 'amber' | 'red'
type Notice = { tone: NoticeTone; text: string }

type ToolCallForm = {
  module: string
  toolName: string
  action: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  aiTaskId: string
  inputSummary: string
  acknowledged: boolean
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[92px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>{label}</span>{children}</label>
}

function toneClass(tone: NoticeTone) {
  return {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-800',
  }[tone]
}

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  if (error instanceof Error) return error.message
  return '操作失败，请检查后端服务。'
}

function numberText(value: unknown, suffix = '') {
  if (value == null || value === '') return '—'
  if (typeof value === 'number' || typeof value === 'string') return `${value}${suffix}`
  return '—'
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">{text}</div>
}

function taskTone(status: string) {
  if (status === 'SUCCEEDED') return 'blue' as const
  if (status === 'FAILED') return 'red' as const
  return 'amber' as const
}

function sourceLabel(source: RagResponse['sources'][number]) {
  const title = source.title || source.fileName || '未命名资料'
  const location = [source.heading, source.paragraph ? `段落 ${source.paragraph}` : null].filter(Boolean).join(' · ')
  return `${title}${source.version ? ` @ ${source.version}` : ''}${location ? `｜${location}` : ''}`
}

export function P2AiWorkbenchView({ active }: { active: ActivePage }) {
  const [gateway, setGateway] = useState<AiGatewayStatus | null>(null)
  const [capabilities, setCapabilities] = useState<AiCapabilityContract[]>([])
  const [tasks, setTasks] = useState<AiTask[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [streamEvents, setStreamEvents] = useState<AiTaskEvent[]>([])
  const [streamTaskId, setStreamTaskId] = useState('')
  // 修复说明：[中危-竞态]，原因：effect 依赖 gateway 对象会因 refresh 重建 EventSource 中断流；改用 ref 读取队列后端。
  const queueBackendRef = useRef(gateway?.queue?.backend || 'unknown')
  queueBackendRef.current = gateway?.queue?.backend || 'unknown'
  const [streamMode, setStreamMode] = useState<'idle' | 'sse' | 'polling' | 'closed'>('idle')
  const [ragQuery, setRagQuery] = useState('')
  const [ragResult, setRagResult] = useState<RagResponse | null>(null)
  const [toolForm, setToolForm] = useState<ToolCallForm>({ module: '', toolName: '', action: '', riskLevel: 'MEDIUM', aiTaskId: '', inputSummary: '', acknowledged: false })
  const [notice, setNotice] = useState<Notice>({ tone: 'blue', text: 'P2.1 只接入现有 AI Gateway、RAG 与人工确认台账；AI 仅提供可追溯草稿与有依据的答复。' })
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (message?: string) => {
    setLoading(true)
    try {
      const [gatewayData, capabilityData, taskData, toolCallData] = await Promise.all([
        api.aiGatewayStatus(),
        api.aiCapabilityContracts('pageSize=20'),
        api.aiTasks('pageSize=20'),
        api.toolCalls('pageSize=20'),
      ])
      setGateway(gatewayData)
      setCapabilities(capabilityData.items)
      setTasks(taskData.items)
      setToolCalls(toolCallData.items)
      if (message) setNotice({ tone: 'green', text: message })
    } catch (error) {
      setNotice({ tone: error instanceof ApiError && error.status === 403 ? 'amber' : 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])


  useEffect(() => {
    const taskId = streamTaskId.trim()
    if (!taskId) return undefined
    let closed = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    const pushPollingEvent = (task: AiTask) => {
      setStreamEvents((old) => old.concat({ id: `${Date.now()}`, taskId: task.id, at: new Date().toISOString(), type: 'polling', status: task.status, stage: 'polling_fallback', terminal: ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(task.status), tokens: Number(task.tokens || 0), cost: String(task.cost ?? '0'), durationMs: Number(task.durationMs || 0), dataSentToCloud: task.dataSentToCloud, summary: { provider: task.provider, model: task.model }, queueBackend: queueBackendRef.current }).slice(-20))
    }
    // 修复说明：[中危-错误静默]，原因：SSE 降级轮询对错误无限静默重试（含 401 会话过期），用户无任何提示且请求循环不停；现连续失败 3 次即停止并提示，401 直接终止。
    let pollFailures = 0
    const startPolling = () => {
      if (pollTimer) return
      setStreamMode('polling')
      pollTimer = setInterval(() => {
        void api.aiTask(taskId).then((task) => {
          pollFailures = 0
          if (closed) return
          pushPollingEvent(task)
          if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(task.status) && pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
            setStreamMode('closed')
          }
        }).catch((error) => {
          pollFailures += 1
          if (error instanceof ApiError && error.status === 401) {
            if (pollTimer) clearInterval(pollTimer)
            pollTimer = null
            setStreamMode('closed')
            return
          }
          if (pollFailures >= 3 && pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
            setStreamMode('closed')
            setNotice({ tone: 'red', text: '任务状态轮询连续失败，请稍后手动刷新。' })
          }
        })
      }, 1200)
    }
    // 修复说明：[中危-发布一致性]，原因：SSE 硬编码根路径会绕过 /new 子路径的 BFF，依赖历史兼容代理且可能在子路径部署失效；与 API client 统一使用 NEXT_PUBLIC_BASE_PATH。
    const events = new EventSource(`${basePath}/api/backend/api/ai-tasks/${encodeURIComponent(taskId)}/events`)
    setStreamMode('sse')
    // 修复说明：[低危-容错]，原因：SSE 帧无 JSON.parse 保护，畸形帧抛未捕获异常；解析失败跳过该帧。
    const parseEvent = (event: MessageEvent) => {
      try {
        return JSON.parse((event as MessageEvent).data) as AiTaskEvent
      } catch {
        return null
      }
    }
    events.addEventListener('status', (event) => {
      const data = parseEvent(event as MessageEvent)
      if (!data) return
      setStreamEvents((old) => old.concat(data).slice(-20))
    })
    events.addEventListener('terminal', (event) => {
      const data = parseEvent(event as MessageEvent)
      if (!data) return
      setStreamEvents((old) => old.concat(data).slice(-20))
      setStreamMode('closed')
      events.close()
    })
    events.onerror = () => {
      events.close()
      if (!closed) startPolling()
    }
    return () => {
      closed = true
      events.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [streamTaskId])

  async function run(action: () => Promise<string>) {
    setLoading(true)
    try {
      const message = await action()
      await refresh(message)
    } catch (error) {
      setNotice({ tone: error instanceof ApiError && [400, 403, 404, 409].includes(error.status) ? 'amber' : 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const askRag = () => run(async () => {
    const query = ragQuery.trim()
    if (!query) throw new Error('请输入要检索的问题。')
    const result = await api.ragQuery({ query, module: active.moduleId })
    setRagResult(result)
    if (result.sources.length === 0) return '资料不足：系统已拒绝在无已审核来源的情况下编造业务答案。'
    return `已返回 ${result.sources.length} 条已审核来源；请在对外使用前人工复核。`
  })


  const runAsyncDraft = () => run(async () => {
    const result = await api.runAiGateway({ async: true, module: 'AI_AGENT', purpose: '前端异步状态测试草稿', level: 'L1', input: { request: '只生成草稿并通过 SSE/轮询查看状态，不执行外部动作。' } })
    setStreamTaskId(result.task.id)
    setStreamEvents([])
    return `异步任务已入队：${result.queue?.backend || gateway?.queue?.backend || 'unknown'}，正在监听状态。`
  })

  const registerToolCall = () => run(async () => {
    if (!toolForm.module.trim() || !toolForm.toolName.trim() || !toolForm.action.trim()) throw new Error('请填写模块、工具名称和动作。')
    if (!toolForm.acknowledged) throw new Error('必须确认这只是待人工确认的台账草稿，且不会执行外部动作。')
    const row = await api.createToolCall({
      module: toolForm.module.trim(),
      toolName: toolForm.toolName.trim(),
      action: toolForm.action.trim(),
      riskLevel: toolForm.riskLevel,
      aiTaskId: toolForm.aiTaskId.trim() || undefined,
      inputSummary: toolForm.inputSummary.trim() ? { operatorSummary: toolForm.inputSummary.trim() } : {},
      requiresHumanConfirmation: true,
    })
    setToolForm((old) => ({ ...old, aiTaskId: row.aiTaskId || old.aiTaskId, inputSummary: '', acknowledged: false }))
    return `工具调用仅登记为 ${row.status}；未调用任何外部系统。`
  })

  const confirmToolCall = (row: ToolCall) => run(async () => {
    if (row.status !== 'PENDING_CONFIRMATION') throw new Error('只有待人工确认的工具调用可以确认。')
    const updated = await api.confirmToolCall(row.id, { confirmedHumanReview: true })
    return `人工复核确认已留痕：${updated.status}。本页面不会执行外部动作。`
  })

  return (
    <div className="space-y-5" data-testid="p2-ai-workbench-view">
      <div className={cn('rounded-xl border p-4 text-[13px] leading-6', toneClass(notice.tone))}>
        <div className="flex items-start gap-2">
          {notice.tone === 'green' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <div><b>P2.1 AI 工作台：</b>{active.moduleName} / {active.subName} · {notice.text}</div>
          <Button className="ml-auto shrink-0" variant="secondary" size="sm" onClick={() => void refresh('AI 状态、契约、审计台账已刷新。')} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" />Gateway 状态</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs leading-5">
            <div className="flex justify-between"><span>启用状态</span><Badge tone={gateway?.enabled ? 'blue' : 'amber'}>{gateway?.enabled ? '已配置' : '本地安全模式'}</Badge></div>
            <div className="flex justify-between"><span>云端就绪</span><b>{gateway?.cloudReady ? '是' : '否'}</b></div>
            <div className="flex justify-between"><span>默认模型</span><b>{gateway?.defaultModel || '—'}</b></div>
            <div className="flex justify-between"><span>密钥暴露给前端</span><b>{gateway?.secretsExposed ? '是（异常）' : '否'}</b></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" />安全边界</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs leading-5 text-slate-600">
            <div>• L5 自动业务决策禁止。</div>
            <div>• 无来源时 RAG 明确拒答。</div>
            <div>• 外部动作必须人工确认并留痕。</div>
            <div>• 不提供自动定价、自动审批、自动发送或自动执行入口。</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-amber-600" />审计摘要</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-slate-50 p-2"><b className="block text-base text-ink">{tasks.length}</b>AiTask</div>
            <div className="rounded-lg bg-slate-50 p-2"><b className="block text-base text-ink">{toolCalls.length}</b>ToolCall</div>
            <div className="rounded-lg bg-slate-50 p-2"><b className="block text-base text-ink">{tasks.filter((item) => item.dataSentToCloud).length}</b>云端传输</div>
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader><CardTitle>异步任务队列与 SSE 状态</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs leading-5">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">queue backend</span><b>{gateway?.queue?.backend || 'unknown'}</b></div>
            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">生产可靠</span><b>{gateway?.queue?.productionReady ? '是' : '否'}</b></div>
            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">stream</span><b>{streamMode}</b></div>
            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">events</span><b>{streamEvents.length}</b></div>
          </div>
          {gateway?.queue?.warning ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">{gateway.queue.warning}</div> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={runAsyncDraft} disabled={loading}>创建异步本地草稿并监听 SSE</Button>
            <Input className="max-w-[360px]" placeholder="或输入已有 AiTask ID 监听" value={streamTaskId} onChange={(event) => setStreamTaskId(event.target.value)} />
          </div>
          {streamEvents.length ? <div className="space-y-2">{streamEvents.map((event) => <div key={event.id} className="rounded-lg border border-line bg-slate-50 px-3 py-2"><div className="flex flex-wrap items-center gap-2"><Badge tone={event.terminal ? 'blue' : 'amber'}>{event.status || event.type}</Badge><span>{event.stage || 'status'}</span><span className="text-muted">tokens={event.tokens} cost={event.cost} duration={event.durationMs}ms cloud={event.dataSentToCloud ? 'yes' : 'no'}</span></div></div>)}</div> : <Empty text="暂无实时事件。SSE 失败时前端会退回 AiTask 轮询；事件只展示脱敏状态、阶段和审计指标。" />}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><SearchCheck className="h-4 w-4 text-brand" />RAG 资料问答与引用</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><b>引用门槛：</b>只使用已审核、未过期资料。没有来源时系统会明确“不知道”，不会补造价格、认证、交期、报关或税务承诺。</div>
            <Field label="问题（仅检索，不自动写入任何业务表）"><textarea className={textareaClass} value={ragQuery} onChange={(event) => setRagQuery(event.target.value)} placeholder="请输入需要核对的产品或流程问题" /></Field>
            <Button onClick={askRag} disabled={loading}><DatabaseZap className="h-4 w-4" />检索已审核资料</Button>
            {ragResult ? (
              <div className="space-y-3 rounded-xl border border-line bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2"><Badge tone={ragResult.sources.length ? 'blue' : 'amber'}>{ragResult.status}</Badge><span className="text-xs text-muted">可信度 {Math.round(ragResult.confidence * 100)}% · {ragResult.mode}</span></div>
                <div className="whitespace-pre-wrap text-sm leading-6 text-ink">{ragResult.answer}</div>
                {ragResult.sources.length ? <div className="space-y-1.5"><b className="text-xs text-slate-600">来源引用</b>{ragResult.sources.map((source, index) => <div key={`${source.chunkId || source.documentId || index}`} className="rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700">{sourceLabel(source)}</div>)}</div> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><b>拒绝无依据回答：</b>当前没有可引用资料；请补充并审核知识资料后再检索。</div>}
                {ragResult.limitations.length ? <div className="text-xs leading-5 text-muted">限制：{ragResult.limitations.join('；')}</div> : null}
              </div>
            ) : <Empty text="尚未检索。结果会显示来源引用；无来源时只显示资料不足说明。" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileWarning className="h-4 w-4 text-amber-600" />能力契约</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {capabilities.length ? capabilities.map((item) => (
              <div key={item.id} className="rounded-lg border border-line p-3 text-xs leading-5">
                <div className="flex items-center gap-2"><b className="text-ink">{item.name}</b><Badge tone={item.status === 'ACTIVE' ? 'blue' : 'amber'}>{item.status}</Badge><Badge tone="purple">{item.level}</Badge></div>
                <div className="mt-1 text-muted">{item.code} @ {item.version} · {item.module}</div>
                <div className="mt-2 text-slate-600">人工确认：{item.specSummary?.requiredHumanConfirmation === false ? '契约未要求（仍受网关治理）' : '必需'}；禁止动作 {numberText(item.specSummary?.forbiddenActionCount)} 项。</div>
              </div>
            )) : <Empty text="当前角色未读取到能力契约；不能据此绕过网关或人工确认。" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardHeader><CardTitle>AiTask 审计：token、成本、时长与数据出境</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {tasks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="border-b border-line text-slate-500"><tr><th className="pb-2 font-medium">用途 / 状态</th><th className="pb-2 font-medium">模型</th><th className="pb-2 font-medium">tokens</th><th className="pb-2 font-medium">成本</th><th className="pb-2 font-medium">时长</th><th className="pb-2 font-medium">数据出境</th></tr></thead><tbody>{tasks.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="py-2.5"><b className="block text-ink">{item.purpose}</b><span className="text-slate-500">{item.module} · <Badge tone={taskTone(item.status)}>{item.status}</Badge></span></td><td className="py-2.5 text-slate-600">{item.model || item.provider}</td><td className="py-2.5">{numberText(item.tokens)}</td><td className="py-2.5">{numberText(item.cost)}</td><td className="py-2.5">{numberText(item.durationMs, ' ms')}</td><td className="py-2.5"><Badge tone={item.dataSentToCloud ? 'amber' : 'blue'}>{item.dataSentToCloud ? '是' : '否'}</Badge></td></tr>)}</tbody></table></div> : <Empty text="暂无 AiTask 审计记录。每次 RAG 或 Gateway 调用均应由后端写入任务、状态和数据出境标志。" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ToolCall：仅登记、人工确认、外部人工执行</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"><b>不会自动执行：</b>此处只能建立待确认台账或留存人工复核；外部发送、发布、价格变更等动作必须由授权人员在外部系统手动完成，再由后端留痕。</div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="模块"><Input value={toolForm.module} onChange={(event) => setToolForm({ ...toolForm, module: event.target.value })} /></Field><Field label="工具名称"><Input value={toolForm.toolName} onChange={(event) => setToolForm({ ...toolForm, toolName: event.target.value })} /></Field><Field label="动作"><Input value={toolForm.action} onChange={(event) => setToolForm({ ...toolForm, action: event.target.value })} /></Field><Field label="风险等级"><select className={inputClass} value={toolForm.riskLevel} onChange={(event) => setToolForm({ ...toolForm, riskLevel: event.target.value as ToolCallForm['riskLevel'] })}>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((item) => <option key={item} value={item}>{item}</option>)}</select></Field><Field label="关联 AiTask ID（可选）"><Input value={toolForm.aiTaskId} onChange={(event) => setToolForm({ ...toolForm, aiTaskId: event.target.value })} /></Field></div>
            <Field label="经人工脱敏后的输入摘要（可选）"><textarea className={textareaClass} value={toolForm.inputSummary} onChange={(event) => setToolForm({ ...toolForm, inputSummary: event.target.value })} placeholder="仅记录必要且已脱敏的操作摘要" /></Field>
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input className="mt-1" type="checkbox" checked={toolForm.acknowledged} onChange={(event) => setToolForm({ ...toolForm, acknowledged: event.target.checked })} />我确认本次只登记待人工确认草稿，不会自动发送、发布、审批、定价或调用任何外部系统。</label>
            <Button variant="secondary" onClick={registerToolCall} disabled={loading}>登记待人工确认 ToolCall</Button>
            {toolCalls.length ? <div className="space-y-2 pt-2">{toolCalls.map((item) => <div key={item.id} className="rounded-lg border border-line p-3 text-xs"><div className="flex flex-wrap items-center gap-2"><b>{item.toolName} / {item.action}</b><Badge tone={item.status === 'PENDING_CONFIRMATION' ? 'amber' : item.status === 'CONFIRMED' ? 'blue' : 'red'}>{item.status}</Badge><Badge tone="purple">{item.riskLevel}</Badge></div><div className="mt-1 text-muted">{item.module} · 人工确认：{item.requiresHumanConfirmation ? '必需' : '异常'}</div>{item.status === 'PENDING_CONFIRMATION' ? <Button className="mt-2" size="sm" variant="secondary" onClick={() => confirmToolCall(item)} disabled={loading}>人工已复核，写入确认</Button> : null}{item.status === 'FAILED' ? <div className="mt-2 rounded-md bg-amber-50 p-2 leading-5 text-amber-900">失败降级：不重试、不自动转发；请由授权人员改为人工处理并在外部系统完成后再留痕。</div> : null}</div>)}</div> : <Empty text="暂无 ToolCall 台账。失败时保持人工处理，不自动重试或替代执行。" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
