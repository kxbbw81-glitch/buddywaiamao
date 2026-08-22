'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// 内置参考汇率（以 USD 为基准，1 USD = X 量该币种）
// 注意：为参考汇率，实际交易以下单时银行牌价为准
const RATES: Record<string, { rate: number; name: string; symbol: string }> = {
  USD: { rate: 1, name: '美元 USD', symbol: '$' },
  CNY: { rate: 7.25, name: '人民币 CNY', symbol: '¥' },
  EUR: { rate: 0.92, name: '欧元 EUR', symbol: '€' },
  GBP: { rate: 0.79, name: '英镑 GBP', symbol: '£' },
  JPY: { rate: 150.5, name: '日元 JPY', symbol: '¥' },
  HKD: { rate: 7.83, name: '港币 HKD', symbol: 'HK$' },
  AUD: { rate: 1.52, name: '澳元 AUD', symbol: 'A$' },
  CAD: { rate: 1.36, name: '加元 CAD', symbol: 'C$' },
  KRW: { rate: 1340, name: '韩元 KRW', symbol: '₩' },
  SGD: { rate: 1.35, name: '新加坡元 SGD', symbol: 'S$' },
}

const QUICK_PAIRS: { label: string; from: string; to: string }[] = [
  { label: 'USD → CNY', from: 'USD', to: 'CNY' },
  { label: 'CNY → USD', from: 'CNY', to: 'USD' },
  { label: 'EUR → CNY', from: 'EUR', to: 'CNY' },
  { label: 'USD → EUR', from: 'USD', to: 'EUR' },
]

function convert(amount: number, from: string, to: string): number {
  if (!amount || !RATES[from] || !RATES[to]) return 0
  // amount 在 from 币种 → USD → to 币种
  const usd = amount / RATES[from].rate
  return usd * RATES[to].rate
}

export function ExchangeConverterView() {
  const [amount, setAmount] = useState('1000')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('CNY')

  const numAmount = parseFloat(amount) || 0
  const result = useMemo(() => convert(numAmount, from, to), [numAmount, from, to])
  const reverseRate = useMemo(() => convert(1, to, from), [from, to])

  const swap = () => { setFrom(to); setTo(from) }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-5 w-5 text-emerald-600" /> 汇率换算
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            内置外贸常用币种参考汇率（以美元为基准），仅供估算，实际交易以下单时银行牌价为准。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 金额 + 源币种 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div className="grid gap-1.5">
              <Label className="text-xs">金额</Label>
              <Input
                type="number" min="0" step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="输入金额"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">源币种</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RATES).map(([code, v]) => (
                    <SelectItem key={code} value={code}>{code} · {v.name.split(' ')[0]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 交换按钮 */}
          <div className="flex justify-center">
            <Button variant="outline" size="icon" onClick={swap} className="rounded-full" title="交换币种">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 目标币种 + 结果 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div className="grid gap-1.5">
              <Label className="text-xs">换算结果</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-lg font-semibold text-emerald-600">
                {result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">目标币种</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RATES).map(([code, v]) => (
                    <SelectItem key={code} value={code}>{code} · {v.name.split(' ')[0]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 汇率明细 */}
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>1 {from} =</span>
              <span className="font-medium text-foreground">{convert(1, from, to).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {to}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>1 {to} =</span>
              <span className="font-medium text-foreground">{reverseRate.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {from}</span>
            </div>
          </div>

          {/* 快捷组合 */}
          <div>
            <Label className="mb-1.5 block text-xs">常用换算</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_PAIRS.map((p) => (
                <Button
                  key={p.label} variant="outline" size="sm"
                  className={cn('h-7 text-xs', from === p.from && to === p.to && 'border-emerald-400 text-emerald-600')}
                  onClick={() => { setFrom(p.from); setTo(p.to) }}
                >
                  {p.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAmount('1000'); setFrom('USD'); setTo('CNY') }}>
                <RotateCcw className="mr-1 h-3 w-3" /> 重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        提示：以上为内置参考汇率，可能与实时牌价存在偏差。涉及实际报价与收款时，请以下单当日银行实际汇率为准。
      </div>
    </div>
  )
}
