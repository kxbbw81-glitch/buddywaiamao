'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Copy, Check, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const SCENARIOS = [
  { value: 'first_touch', label: '首封开发信', desc: '首次接触，建立信任' },
  { value: 'follow_up', label: '跟进催复', desc: '已发过信息未回，跟进' },
  { value: 'wake_silent', label: '沉默唤醒', desc: '30天+未回复客户唤醒' },
  { value: 'holiday', label: '节日问候', desc: '节日关怀，不直接销售' },
]

export function FollowupCopyView() {
  const [scenario, setScenario] = useState('first_touch')
  const [customerName, setCustomerName] = useState('')
  const [product, setProduct] = useState('')
  const [language, setLanguage] = useState('en')
  const [tone, setTone] = useState('professional')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ copy: string; mode: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    if (!customerName.trim()) {
      toast.error('请填写客户名称')
      return
    }
    setLoading(true)
    setCopied(false)
    try {
      const res = await fetch('/api/followup-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, customerName: customerName.trim(), product: product.trim(), language, tone }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || '生成失败')
        return
      }
      setResult({ copy: json.data.copy, mode: json.data.mode })
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.copy)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败，请手动选择文本')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-emerald-600" /> 跟进话术生成
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            按场景与客户信息，AI 生成可直接使用的多语言跟进话术。遵循已配置的销售打法；未配置 AI 时使用内置模板。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 场景选择 */}
          <div className="grid gap-1.5">
            <Label className="text-xs">场景</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SCENARIOS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScenario(s.value)}
                  className={cn(
                    'rounded-lg border p-2.5 text-left transition-colors',
                    scenario === s.value ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950' : 'hover:bg-muted/30',
                  )}
                >
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 客户名 + 产品 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">客户名称 *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="如 TechVista / Mr. Smith" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">产品/行业（可选）</Label>
              <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="如 LED 灯具 / 服装 / 五金" />
            </div>
          </div>

          {/* 语言 + 语气 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">语言</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">英文（商务英文）</SelectItem>
                  <SelectItem value="zh">简体中文</SelectItem>
                  <SelectItem value="bilingual">双语（英文+中文对照）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">语气</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">专业商务</SelectItem>
                  <SelectItem value="friendly">友好亲和</SelectItem>
                  <SelectItem value="formal">正式</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={generate} disabled={loading || !customerName.trim()} className="w-full">
            {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> 生成中…</> : <><Sparkles className="mr-1.5 h-4 w-4" /> 生成话术</>}
          </Button>
        </CardContent>
      </Card>

      {/* 结果 */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">生成结果</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={result.mode === 'llm' ? 'default' : 'secondary'} className="h-5 text-[10px]">
                {result.mode === 'llm' ? 'AI 生成' : '本地模板'}
              </Badge>
              <Button variant="outline" size="sm" onClick={copy} className="h-7">
                {copied ? <><Check className="mr-1 h-3.5 w-3.5" /> 已复制</> : <><Copy className="mr-1 h-3.5 w-3.5" /> 复制</>}
              </Button>
            </div>
          </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={result.copy}
              readOnly
              rows={Math.min(16, result.copy.split('\n').length + 2)}
              className="resize-none font-mono text-xs leading-relaxed"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="h-7 text-xs">
                <RefreshCw className="mr-1 h-3 w-3" /> 重新生成
              </Button>
              {result.mode === 'local' && (
                <span className="text-[11px] text-muted-foreground">本地模板模式——配置 AI 后可获更贴合的智能生成</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
