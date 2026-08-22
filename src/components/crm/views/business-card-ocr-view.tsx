'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, IdCard, ScanLine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type OcrState = 'idle' | 'loading' | 'done'

interface OcrField {
  k: string
  v: string
  conf: number
}

/** 演示名片识别结果（浏览器端模拟 OCR，字段仅作为候选数据） */
const DEMO_FIELDS: OcrField[] = [
  { k: '客户名称', v: 'Müller Industrie GmbH', conf: 98 },
  { k: '主联系人', v: 'Thomas Müller', conf: 97 },
  { k: '职位', v: 'Purchasing Manager', conf: 93 },
  { k: '邮箱', v: 't.muller@mueller-industrie.de', conf: 96 },
  { k: '电话', v: '+49 89 1234 5678', conf: 92 },
  { k: 'WhatsApp', v: '+49 172 345 6789', conf: 78 },
  { k: '国家 / 城市', v: '德国 · 慕尼黑', conf: 95 },
]

const TOOL_STATUS = [
  { mark: 'OCR', name: '名片 OCR 识别', badge: '启用', ok: true },
  { mark: 'WEB', name: '官网链接登记', badge: '零网页访问', ok: false },
  { mark: 'FX', name: '汇率换算', badge: '已接入', ok: false },
  { mark: 'DUP', name: '客户去重', badge: '规则', ok: false },
  { mark: 'TXT', name: '跟进话术生成', badge: '已接入', ok: false },
  { mark: 'HS', name: 'HS 编码速查', badge: '已接入', ok: false },
]

export function BusinessCardOcrView() {
  const [state, setState] = useState<OcrState>('idle')
  const [synced, setSynced] = useState(false)

  const runOcr = () => {
    setState('loading')
    setSynced(false)
    setTimeout(() => setState('done'), 800)
  }

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'business_card_ocr',
          subject: `名片线索：Müller Industrie GmbH（Purchasing Manager Thomas Müller）`,
          content: [
            '来源：工具中心 · 名片 OCR 识别（人工确认后同步）',
            `客户名称：Müller Industrie GmbH`,
            `主联系人：Thomas Müller（Purchasing Manager）`,
            `邮箱：t.muller@mueller-industrie.de`,
            `电话：+49 89 1234 5678 / WhatsApp：+49 172 345 6789（低置信度，待人工确认）`,
            `国家 / 城市：德国 · 慕尼黑`,
            '重复检查：邮箱域名与现有客户相似度 41% —— 判定为新客户',
          ].join('\n'),
          language: 'de',
          priority: 'normal',
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '同步失败')
      return json.data
    },
    onSuccess: (data) => {
      setSynced(true)
      toast.success(`已同步到线索池：Müller Industrie GmbH（询盘号 ${data.inquiryNo}）`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const avgConf = Math.round(DEMO_FIELDS.reduce((s, f) => s + f.conf, 0) / DEMO_FIELDS.length)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <IdCard className="h-5 w-5 text-purple-700" /> 名片 OCR 识别
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            展会名片拍下来，识别 → 重复检查 → 人工确认后同步到线索池。识别结果只是候选数据，写入前必须人工确认（安全边界与官网链接登记一致）。
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">工具中心 6 件套</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {TOOL_STATUS.map((t) => (
              <div
                key={t.name}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
                  t.mark === 'OCR' ? 'border-purple-300 bg-purple-50 text-purple-900' : 'border-transparent text-muted-foreground'
                )}
              >
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                  {t.mark}
                </span>
                <span className="flex-1 truncate">{t.name}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px]',
                    t.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {t.badge}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {state === 'idle' && (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-12">
                <ScanLine className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">等待上传名片</p>
                <Button onClick={runOcr} size="sm">
                  加载演示名片
                </Button>
                <p className="text-xs text-muted-foreground">
                  支持 JPG / PNG，识别在浏览器完成，字段仅作为候选数据
                </p>
              </div>
            )}

            {state === 'loading' && (
              <div className="py-12 text-center text-sm text-muted-foreground">正在识别名片（OCR）……</div>
            )}

            {state === 'done' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <span className="block text-xs text-muted-foreground">当前任务</span>
                    <b className="text-sm">名片 OCR</b>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <span className="block text-xs text-muted-foreground">已识别字段</span>
                    <b className="text-sm">{DEMO_FIELDS.length} / {DEMO_FIELDS.length}</b>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <span className="block text-xs text-muted-foreground">平均置信度</span>
                    <b className="text-sm">{avgConf}%</b>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <span className="block text-xs text-muted-foreground">重复检查</span>
                    <b className="text-sm text-emerald-700">新客户</b>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {DEMO_FIELDS.map((f) => (
                    <div key={f.k} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">{f.k}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{f.v}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-xs',
                          f.conf < 85 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {f.conf}%{f.conf < 85 ? ' · 需确认' : ''}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  重复检查：邮箱域名 <b className="text-foreground">mueller-industrie.de</b> 与现有客户 Müller GmbH 相似度
                  41% —— <span className="font-semibold text-emerald-700">判定为新客户</span>，可同步
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 text-xs text-purple-900">
                  <span>
                    同步目标：线索池 · 来源「名片 OCR」 · 初始阶段「新线索」 · 分配当前团队
                  </span>
                  {synced ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <BadgeCheck className="h-4 w-4" /> 已同步到线索池
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                      {sync.isPending ? '同步中…' : '确认同步'}
                    </Button>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={runOcr}>
                    重新识别
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
