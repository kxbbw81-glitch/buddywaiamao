'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, ExternalLink, FileSearch, Globe2, Search, WandSparkles } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, DedupeResult, ToolFollowupCopyResult, ToolFxResult, ToolHsResult, ToolOcrResult, ToolWebsiteLinkResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type Notice = { tone: 'blue' | 'green' | 'amber' | 'red'; text: string }

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[86px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  if (error instanceof Error) return error.message
  return '操作失败，请检查后端服务。'
}

function noticeClass(tone: Notice['tone']) {
  return {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-800',
  }[tone]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>{label}</span>{children}</label>
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-[220px] overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{JSON.stringify(value, null, 2)}</pre>
}

export function P3ToolsCenterView({ active }: { active: ActivePage }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [notice, setNotice] = useState<Notice>({ tone: 'blue', text: 'P3 工具中心六项已接入后端最小闭环；真实外部服务仍按单独授权接入。' })
  const [loading, setLoading] = useState(false)
  const [ocr, setOcr] = useState<ToolOcrResult | null>(null)
  const [website, setWebsite] = useState<ToolWebsiteLinkResult | null>(null)
  const [fx, setFx] = useState<ToolFxResult | null>(null)
  const [dedupe, setDedupe] = useState<DedupeResult | null>(null)
  const [copy, setCopy] = useState<ToolFollowupCopyResult | null>(null)
  const [hs, setHs] = useState<ToolHsResult | null>(null)

  const [ocrText, setOcrText] = useState('Ana Silva\nNexFab Buyer Ltd\nana@nexfab-buyer.example\n+1 202 555 0101\nnexfab-buyer.example')
  const [websiteUrl, setWebsiteUrl] = useState('https://nexfab-buyer.example')
  const [fxAmount, setFxAmount] = useState('100')
  const [fxFrom, setFxFrom] = useState('USD')
  const [fxTo, setFxTo] = useState('CNY')
  const [dedupeKeyword, setDedupeKeyword] = useState('NexFab Buyer')
  const [copyScenario, setCopyScenario] = useState('follow_up')
  const [hsKeyword, setHsKeyword] = useState('filament')

  const selectedCustomer = useMemo(() => customers[0], [customers])

  async function refreshCustomers() {
    try {
      const result = await api.customers('pageSize=5')
      setCustomers(result.items)
    } catch (error) {
      setNotice({ tone: 'amber', text: `客户列表暂不可用：${errorText(error)}` })
    }
  }

  useEffect(() => { void refreshCustomers() }, [])

  async function run<T>(action: () => Promise<T>, onSuccess: (result: T) => void, message: string) {
    setLoading(true)
    try {
      const result = await action()
      onSuccess(result)
      setNotice({ tone: 'green', text: message })
      await refreshCustomers()
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const runOcr = () => run(
    () => api.toolOcr({ imageName: 'business-card-demo.txt', dryRun: true, content: ocrText }),
    setOcr,
    '名片 OCR dry-run 已返回候选字段，写入客户前仍需人工确认。',
  )

  const runWebsite = () => {
    if (!selectedCustomer) return setNotice({ tone: 'amber', text: '请先创建或加载一个客户，再登记官网链接。' })
    return run(
      () => api.toolWebsiteLink({ customerId: selectedCustomer.id, website: websiteUrl, note: 'P3 工具中心人工登记' }),
      setWebsite,
      '官网链接已登记到客户档案，并复用客户指纹查重。',
    )
  }

  const runFx = () => run(
    () => api.toolFx(new URLSearchParams({ from: fxFrom, to: fxTo, amount: fxAmount }).toString()),
    setFx,
    '汇率换算已返回本地参考结果。',
  )

  const runDedupe = () => run(
    () => api.dedupe({ companyName: dedupeKeyword, website: websiteUrl }),
    setDedupe,
    '客户去重已按当前用户数据范围返回候选。',
  )

  const runCopy = () => run(
    () => api.toolFollowupCopy({ scenario: copyScenario, customerId: selectedCustomer?.id, customerName: selectedCustomer?.name || dedupeKeyword, language: 'en', product: 'PLA filament' }),
    setCopy,
    '跟进话术模板草稿已生成；外发前必须人工确认。',
  )

  const runHs = () => run(
    () => api.toolHs(new URLSearchParams({ keyword: hsKeyword }).toString()),
    setHs,
    'HS 编码本地参考速查已返回。',
  )

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-3 text-[13px] leading-6 ${noticeClass(notice.tone)}`}>{notice.text}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" />名片 OCR 识别 <Badge tone="purple">dry-run</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea className={textareaClass} value={ocrText} onChange={(event) => setOcrText(event.target.value)} />
            <Button onClick={runOcr} disabled={loading}>解析候选字段</Button>
            {ocr ? <JsonBlock value={ocr} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4" />官网链接登记 <Badge>Customer</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="当前客户">{selectedCustomer ? <Input value={`${selectedCustomer.name} / ${selectedCustomer.id}`} readOnly /> : <Input value="暂无客户，请先在客户管理创建" readOnly />}</Field>
            <Field label="官网链接"><Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} /></Field>
            <Button onClick={runWebsite} disabled={loading || !selectedCustomer}>登记官网</Button>
            {website ? <JsonBlock value={website} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ExternalLink className="h-4 w-4" />汇率换算 <Badge>本地参考</Badge></CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Input value={fxAmount} onChange={(event) => setFxAmount(event.target.value)} />
            <Input value={fxFrom} onChange={(event) => setFxFrom(event.target.value.toUpperCase())} />
            <Input value={fxTo} onChange={(event) => setFxTo(event.target.value.toUpperCase())} />
            <Button onClick={runFx} disabled={loading}>换算</Button>
            <div className="sm:col-span-4">{fx ? <JsonBlock value={fx} /> : null}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-4 w-4" />客户去重 <Badge>指纹库</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="公司名 / 关键词"><Input value={dedupeKeyword} onChange={(event) => setDedupeKeyword(event.target.value)} /></Field>
            <Button onClick={runDedupe} disabled={loading}>查重</Button>
            {dedupe ? <JsonBlock value={dedupe} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><WandSparkles className="h-4 w-4" />跟进话术生成 <Badge tone="purple">模板</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="场景"><select className={inputClass} value={copyScenario} onChange={(event) => setCopyScenario(event.target.value)}><option value="first_touch">首次开发</option><option value="follow_up">报价跟进</option><option value="wake_silent">沉默唤醒</option><option value="holiday">节日问候</option></select></Field>
            <Button onClick={runCopy} disabled={loading}>生成草稿</Button>
            {copy ? <JsonBlock value={copy} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSearch className="h-4 w-4" />HS 编码速查 <Badge>本地参考</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="关键词"><Input value={hsKeyword} onChange={(event) => setHsKeyword(event.target.value)} /></Field>
            <Button onClick={runHs} disabled={loading}>速查</Button>
            {hs ? <JsonBlock value={hs} /> : null}
          </CardContent>
        </Card>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-500">
        当前入口：{active.moduleName} / {active.subName}。六项工具均消费后端 API；真实 OCR、实时汇率源、正式 HS 数据源和 AI 话术生成需后续单独授权。
      </div>
    </div>
  )
}
