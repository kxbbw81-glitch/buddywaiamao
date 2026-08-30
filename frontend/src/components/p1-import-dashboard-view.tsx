'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { AlertTriangle, BarChart3, Download, FileSpreadsheet, RefreshCw, UploadCloud } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { DashboardBusinessItem, DashboardData, ImportReport, ImportTemplate } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type ImportType = 'leads' | 'customers' | 'products' | 'supplier-costs' | 'quote-rules'
type NoticeTone = 'blue' | 'green' | 'amber' | 'red'

const importTypes: Array<{ type: ImportType; label: string; api: string }> = [
  { type: 'leads', label: '线索导入', api: '/api/import/leads' },
  { type: 'customers', label: '客户导入', api: '/api/import/customers' },
  { type: 'products', label: '产品导入', api: '/api/import/products' },
  { type: 'supplier-costs', label: '供应商/成本导入', api: '/api/import/supplier-costs' },
  { type: 'quote-rules', label: '报价规则导入', api: '/api/import/quote-rules' },
]
const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[148px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'

function toneClass(tone: NoticeTone) {
  return { blue: 'border-blue-200 bg-blue-50 text-blue-900', green: 'border-emerald-200 bg-emerald-50 text-emerald-800', amber: 'border-amber-200 bg-amber-50 text-amber-900', red: 'border-red-200 bg-red-50 text-red-800' }[tone]
}
function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}${error.detail ? `｜${JSON.stringify(error.detail)}` : ''}`
  if (error instanceof Error) return error.message
  return '操作失败，请检查后端服务。'
}
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"' && quoted && next === '"') { current += '"'; i += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === ',' && !quoted) { row.push(current.trim()); current = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(current.trim()); current = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
      continue
    }
    current += char
  }
  row.push(current.trim())
  if (row.some(Boolean)) rows.push(row)
  if (!rows.length) return []
  const headers = rows[0].map((item) => item.trim()).filter(Boolean)
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))).filter((item) => Object.values(item).some(Boolean))
}
function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const headers = lines[0].split('\t').map((item) => item.trim()).filter(Boolean)
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split('\t')[index] ?? '']))).filter((item) => Object.values(item).some(Boolean))
}
async function rowsFromFile(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(await file.text())
  if (name.endsWith('.tsv')) return parseTsv(await file.text())
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const first = workbook.SheetNames[0]
    if (!first) return []
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], { defval: '' })
  }
  throw new Error('仅支持 CSV / TSV / Excel 文件。')
}
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // 修复说明：[低危-下载兼容性]，原因：未挂载 DOM 即 click 在部分浏览器不触发，同步 revoke 可能截断下载；挂载后触发并延迟释放。
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
function csvDictionary(template: ImportTemplate | null) {
  if (!template) return ''
  return ['field,description,constraint', ...template.columns.map((item) => [item.field, item.description, item.constraint].map((value) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(','))].join('\n')
}
function roleScopeLabel(role?: string) {
  if (role === 'SALES') return '仅本人负责的业务与个人队列'
  if (role === 'MANAGER') return '本人及所属团队可见范围'
  if (role === 'FINANCE') return '财务权限范围与财务队列'
  if (role === 'EXEC') return '管理层可见范围'
  if (role === 'ADMIN') return '管理员可见范围'
  return '以当前登录角色的后端授权范围为准'
}
function ReportList({ title, rows }: { title: string; rows?: Array<Record<string, unknown>> }) {
  if (!rows?.length) return null
  return <div className="rounded-lg border border-line bg-slate-50 p-3"><b className="text-xs text-slate-600">{title}</b><pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-500">{JSON.stringify(rows.slice(0, 8), null, 2)}</pre></div>
}
function MetricGroup({ title, items }: { title: string; items?: DashboardBusinessItem[] }) {
  if (!items?.length) return null
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{items.map((item) => <div key={item.id} className="rounded-lg border border-line bg-slate-50 p-3"><div className="text-xs text-muted">{item.label}</div><div className="mt-2 text-2xl font-semibold text-ink">{item.value}</div>{item.severity ? <Badge className="mt-2" tone={item.severity === 'red' ? 'red' : item.severity === 'amber' ? 'amber' : 'blue'}>{item.severity}</Badge> : null}</div>)}</CardContent></Card>
}

export function P1ImportDashboardView({ active }: { active: ActivePage }) {
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [selectedType, setSelectedType] = useState<ImportType>('leads')
  const [template, setTemplate] = useState<ImportTemplate | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [rawText, setRawText] = useState('')
  const [duplicateCheckConfirmed, setDuplicateCheckConfirmed] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string }>({ tone: 'blue', text: 'P1.4 导入中心不会写入样例数据；dryRun 只预览，正式导入必须人工确认。' })
  const [loading, setLoading] = useState(false)

  const selectedMeta = useMemo(() => importTypes.find((item) => item.type === selectedType) || importTypes[0], [selectedType])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [templateList, templateDetail, dashboardData] = await Promise.all([
        api.importTemplates(),
        api.importTemplate(selectedType),
        api.dashboard('30d'),
      ])
      setTemplates(templateList.items)
      setTemplate(templateDetail)
      setDashboard(dashboardData)
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }, [selectedType])

  useEffect(() => { void refresh() }, [refresh])

  async function parseUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const parsed = await rowsFromFile(file)
      setRows(parsed)
      setReport(null)
      setNotice({ tone: parsed.length ? 'green' : 'amber', text: `已解析 ${parsed.length} 行，来源文件：${file.name}。请先执行 dryRun 预览。` })
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }
  function parseText() {
    const parsed = rawText.includes('\t') ? parseTsv(rawText) : parseCsv(rawText)
    setRows(parsed)
    setReport(null)
    setNotice({ tone: parsed.length ? 'green' : 'amber', text: `已从粘贴内容解析 ${parsed.length} 行。请先执行 dryRun 预览。` })
  }
  async function submit(dryRun: boolean) {
    setLoading(true)
    try {
      const result = await api.importRows(selectedType, { dryRun, confirmImport: !dryRun, duplicateCheckConfirmed, rows })
      setReport(result)
      setNotice({ tone: dryRun ? 'blue' : 'green', text: dryRun ? 'dryRun 预览完成，未写业务数据。' : '正式导入完成，已由后端写入审计。' })
      if (!dryRun) await refresh()
    } catch (error) {
      setNotice({ tone: error instanceof ApiError && [400, 403, 409].includes(error.status) ? 'amber' : 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const sampleHeader = template?.csvHeader || ''

  return (
    <div className="space-y-5" data-testid="p1-import-dashboard-view">
      <div className={cn('rounded-xl border p-4 text-[13px] leading-6', toneClass(notice.tone))}>
        <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4" /><div><b>P1.4 模板导入与经营看板：</b>{active.moduleName} / {active.subName} · {notice.text}</div><Button className="ml-auto shrink-0" variant="secondary" size="sm" disabled={loading} onClick={() => void refresh()}><RefreshCw className="h-3.5 w-3.5" />刷新</Button></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>标准模板与 CSV / Excel 导入</CardTitle><Badge tone="blue">dryRun → 人工确认</Badge></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>导入类型</span><select className={inputClass} value={selectedType} onChange={(event) => { setSelectedType(event.target.value as ImportType); setRows([]); setReport(null) }}>{importTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>选择 CSV 或 Excel</span><Input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={parseUpload} disabled={loading} /></label>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-900">
              <b>模板不含业务样例数据：</b>只下载列名、字段说明和校验约束。Excel 文件在浏览器本地解析第一张表，正式写入仍由后端 RBAC、PII、去重和审计控制。
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!template} onClick={() => downloadText(`nexfab-${selectedType}-template.csv`, sampleHeader)}><Download className="h-4 w-4" />下载空白 CSV 模板</Button>
              <Button variant="secondary" disabled={!template} onClick={() => downloadText(`nexfab-${selectedType}-fields.csv`, csvDictionary(template))}><FileSpreadsheet className="h-4 w-4" />下载字段说明</Button>
            </div>
            <textarea className={textareaClass} value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder={sampleHeader ? `${sampleHeader}\n` : '先选择模板后粘贴 CSV/Excel 复制出的表格内容'} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={parseText} disabled={loading || !rawText.trim()}><UploadCloud className="h-4 w-4" />解析粘贴内容</Button>
              <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={duplicateCheckConfirmed} onChange={(event) => setDuplicateCheckConfirmed(event.target.checked)} />已人工确认重复/冲突仍导入</label>
              <Button variant="secondary" onClick={() => void submit(true)} disabled={loading || !rows.length}>dryRun 预览</Button>
              <Button onClick={() => void submit(false)} disabled={loading || !rows.length}>确认正式导入</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-slate-50 p-3"><b className="text-xs text-slate-600">已解析行数</b><div className="mt-2 text-2xl font-semibold">{rows.length}</div><p className="mt-2 text-[11px] text-muted">API：{selectedMeta.api}</p></div>
              <div className="rounded-lg border border-line bg-slate-50 p-3"><b className="text-xs text-slate-600">可用模板</b><div className="mt-2 text-2xl font-semibold">{templates.length}</div><p className="mt-2 text-[11px] text-muted">当前角色可访问模板；财务等无权业务会返回 403。</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>导入报告</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {report ? <div className="grid grid-cols-3 gap-2 text-center text-xs">{Object.entries(report.summary).map(([key, value]) => <div key={key} className="rounded-lg border border-line bg-white p-3"><div className="text-muted">{key}</div><b className="mt-1 block text-lg text-ink">{value ?? 0}</b></div>)}</div> : <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">暂无报告。先解析文件并执行 dryRun。</div>}
            <ReportList title="wouldCreate / created" rows={[...(report?.wouldCreate || []), ...(report?.created || [])]} />
            <ReportList title="updated" rows={report?.updated} />
            <ReportList title="conflicts / skipped" rows={[...(report?.conflicts || []), ...(report?.skipped || [])]} />
            <ReportList title="errors" rows={report?.errors} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>基础经营看板</CardTitle><Badge tone="amber">{dashboard?.business?.rangeLabel || '当前累计概览'}</Badge></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><BarChart3 className="mr-1 inline h-4 w-4" />{dashboard?.business?.note || '当前后端返回累计概览，暂不展示为严格日期窗口统计。'}</div>
          <div className="rounded-lg border border-line bg-slate-50 p-3 text-xs leading-6 text-slate-600"><b>数据范围：</b>{roleScopeLabel(dashboard?.role)}。统计范围和风险队列由后端角色权限实时计算，前端不合并或猜测不可见数据。</div>
          <div className="grid gap-4 xl:grid-cols-2">
            <MetricGroup title="漏斗" items={dashboard?.business?.funnel} />
            <MetricGroup title="报价/订单/回款" items={dashboard?.business?.revenue} />
            <MetricGroup title="履约运营" items={dashboard?.business?.operations} />
            <MetricGroup title="风险队列" items={dashboard?.business?.risks} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
