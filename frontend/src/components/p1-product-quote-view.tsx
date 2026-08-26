'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { AlertTriangle, CheckCircle2, FileText, Lock, PackagePlus, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, Product, ProductCategory, ProductDoc, Quote, QuoteCalculationResult, QuoteVersion } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type NoticeTone = 'blue' | 'green' | 'amber' | 'red'
type Notice = { tone: NoticeTone; text: string }

type ProductForm = {
  categoryName: string
  categoryId: string
  sku: string
  name: string
  specsJson: string
  packingJson: string
  costJson: string
  active: boolean
}

type ProductDocForm = { productId: string; type: string; status: string; fileUrl: string; validUntil: string }
type CalcForm = {
  customerId: string
  productId: string
  quantity: string
  tradeTerm: 'EXW' | 'FOB' | 'CIF' | 'DDP'
  currency: string
  fxRateCnyPerUsd: string
  marginRate: string
  minimumMarginRate: string
  internationalFreightUsd: string
  destinationPortChargesUsd: string
  customsClearanceUsd: string
  dutyRate: string
  deliveryFeeUsd: string
}
type QuoteForm = { notes: string; minimumMarginRate: string; validityDays: string; recipient: string; subject: string; message: string; confirmedExternalSend: boolean }

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[84px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'

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

function parseJsonObject(value: string, field: string) {
  const trimmed = value.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${field} 必须是 JSON 对象。`)
  return parsed as Record<string, unknown>
}

function numeric(value: string, fallback?: number) {
  if (!value.trim()) return fallback
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) throw new Error('数字字段格式不正确。')
  return numberValue
}

function money(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value)
}

function percent(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? `${(numberValue * 100).toFixed(2)}%` : String(value)
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">{text}</div>
}

export function P1ProductQuoteView({ active }: { active: ActivePage }) {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productDocs, setProductDocs] = useState<ProductDoc[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [versions, setVersions] = useState<QuoteVersion[]>([])
  const [selectedQuoteId, setSelectedQuoteId] = useState('')
  const [calculation, setCalculation] = useState<QuoteCalculationResult | null>(null)
  const [notice, setNotice] = useState<Notice>({ tone: 'blue', text: 'P1.2 页面只展示和触发产品/报价后端能力；成本、费用、毛利、审批、PDF 与发送留痕均由后端校验。' })
  const [loading, setLoading] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<number | null>(null)

  const [productForm, setProductForm] = useState<ProductForm>({ categoryName: '', categoryId: '', sku: '', name: '', specsJson: '{}', packingJson: '{}', costJson: '{}', active: true })
  const [docForm, setDocForm] = useState<ProductDocForm>({ productId: '', type: 'TDS', status: 'REVIEWED', fileUrl: '', validUntil: '' })
  const [calcForm, setCalcForm] = useState<CalcForm>({ customerId: '', productId: '', quantity: '', tradeTerm: 'FOB', currency: 'USD', fxRateCnyPerUsd: '', marginRate: '', minimumMarginRate: '', internationalFreightUsd: '', destinationPortChargesUsd: '', customsClearanceUsd: '', dutyRate: '', deliveryFeeUsd: '' })
  const [quoteForm, setQuoteForm] = useState<QuoteForm>({ notes: '', minimumMarginRate: '0.15', validityDays: '30', recipient: '', subject: '', message: '', confirmedExternalSend: false })

  const selectedProduct = useMemo(() => products.find((item) => item.id === calcForm.productId || item.id === docForm.productId) || null, [products, calcForm.productId, docForm.productId])
  const selectedQuote = useMemo(() => quotes.find((item) => item.id === selectedQuoteId) || null, [quotes, selectedQuoteId])
  const selectedVersion = versions[0]

  const refresh = useCallback(async (message?: string) => {
    setLoading(true)
    try {
      const [categoryList, productList, customerList, quoteList] = await Promise.all([
        api.productCategories('pageSize=50'),
        api.products('pageSize=20'),
        api.customers('pageSize=20'),
        api.quotes('pageSize=20'),
      ])
      setCategories(categoryList.items)
      setProducts(productList.items)
      setCustomers(customerList.items)
      setQuotes(quoteList.items)
      const productId = productList.items[0]?.id || ''
      const customerId = customerList.items[0]?.id || ''
      const quoteId = selectedQuoteId || quoteList.items[0]?.id || ''
      setProductForm((old) => ({ ...old, categoryId: old.categoryId || categoryList.items[0]?.id || '' }))
      setDocForm((old) => ({ ...old, productId: old.productId || productId }))
      setCalcForm((old) => ({ ...old, productId: old.productId || productId, customerId: old.customerId || customerId }))
      setSelectedQuoteId(quoteId)
      if (productId) {
        const docs = await api.productDocs(productId, 'pageSize=8').catch(() => ({ items: [], page: 1, pageSize: 8, total: 0 }))
        setProductDocs(docs.items)
      }
      if (quoteId) {
        const versionList = await api.quoteVersions(quoteId, 'pageSize=8').catch(() => ({ items: [], page: 1, pageSize: 8, total: 0 }))
        setVersions(versionList.items)
      }
      if (message) setNotice({ tone: 'green', text: message })
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }, [selectedQuoteId])

  useEffect(() => { void refresh() }, [refresh])

  async function run(action: () => Promise<string | Notice>) {
    setLoading(true)
    try {
      const result = await action()
      await refresh(typeof result === 'string' ? result : undefined)
      if (typeof result !== 'string') setNotice(result)
    } catch (error) {
      setNotice({ tone: error instanceof ApiError && [400, 403, 404, 409].includes(error.status) ? 'amber' : 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const createCategory = () => run(async () => {
    if (!productForm.categoryName.trim()) throw new Error('请填写分类名称。')
    const category = await api.createProductCategory({ name: productForm.categoryName.trim() })
    setProductForm((old) => ({ ...old, categoryId: category.id, categoryName: '' }))
    return `已创建产品分类：${category.name}`
  })

  const createProduct = () => run(async () => {
    const categoryId = productForm.categoryId || categories[0]?.id
    if (!categoryId) throw new Error('请先创建或选择产品分类。')
    const product = await api.createProduct({ sku: productForm.sku, name: productForm.name, categoryId, specs: parseJsonObject(productForm.specsJson, '规格'), packing: parseJsonObject(productForm.packingJson, '包装'), costVersions: parseJsonObject(productForm.costJson, '成本版本'), active: productForm.active })
    setDocForm((old) => ({ ...old, productId: product.id }))
    setCalcForm((old) => ({ ...old, productId: product.id }))
    return `已创建产品 ${product.sku}，可继续维护资料并计算报价。`
  })

  const createProductDoc = () => run(async () => {
    const productId = docForm.productId || selectedProduct?.id
    if (!productId) throw new Error('请先选择产品。')
    await api.createProductDoc(productId, { type: docForm.type, status: docForm.status, fileUrl: docForm.fileUrl, validUntil: docForm.validUntil || undefined })
    return '产品资料状态已写入，可在产品资料列表中查看。'
  })

  const calculate = async () => {
    setLoading(true)
    setPdfBytes(null)
    try {
      if (!calcForm.productId) throw new Error('请选择产品。')
      const result = await api.calculateQuote({
        customerId: calcForm.customerId || undefined,
        tradeTerm: calcForm.tradeTerm,
        rules: {
          currency: calcForm.currency,
          fxRateCnyPerUsd: numeric(calcForm.fxRateCnyPerUsd, undefined),
          marginRate: numeric(calcForm.marginRate, undefined),
          minimumMarginRate: numeric(calcForm.minimumMarginRate, undefined),
          charges: {
            internationalFreightUsd: numeric(calcForm.internationalFreightUsd, undefined),
            destinationPortChargesUsd: numeric(calcForm.destinationPortChargesUsd, undefined),
            customsClearanceUsd: numeric(calcForm.customsClearanceUsd, undefined),
            dutyRate: numeric(calcForm.dutyRate, undefined),
            deliveryFeeUsd: numeric(calcForm.deliveryFeeUsd, undefined),
          },
        },
        items: [{ productId: calcForm.productId, quantity: numeric(calcForm.quantity, undefined) }],
      })
      setCalculation(result)
      setNotice({ tone: result.approval.required ? 'amber' : 'green', text: result.approval.required ? `报价已计算，但毛利率 ${percent(result.approval.actualMarginRate)} 低于最低要求，需要审批或调整。` : '报价计算通过，可创建报价版本。' })
    } catch (error) {
      setNotice({ tone: 'amber', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const createQuickQuote = () => run(async () => {
    if (!calculation) throw new Error('请先完成报价计算。')
    if (!calcForm.customerId) throw new Error('请选择客户后才能创建正式报价。')
    const line = calculation.lines[0]
    const quote = await api.quickQuote({
      customerId: calcForm.customerId,
      currency: calculation.currency,
      notes: quoteForm.notes,
      items: [{ productId: line.productId, sku: line.sku, name: line.name, quantity: line.quantity, unitPrice: calculation.totals.selectedUnitPrice, unitCost: line.unitCostUsd }],
    })
    setSelectedQuoteId(quote.id)
    return `已创建报价 ${quote.id}，版本 ${quote.versions?.[0]?.version || 1} 已生成。`
  })

  const lockVersion = () => run(async () => {
    if (!selectedQuote || !selectedVersion) throw new Error('请先选择报价和版本。')
    const result = await api.lockQuoteVersion(selectedQuote.id, selectedVersion.id, { minimumMarginRate: numeric(quoteForm.minimumMarginRate, 0.15), validityDays: numeric(quoteForm.validityDays, 30), note: '前端人工锁定检查' })
    if ('status' in result && result.status === 'APPROVAL_REQUIRED') return { tone: 'amber', text: '低毛利报价已进入审批队列，未审批前不会锁定 PDF 快照。' }
    return '报价版本已锁定，PDF 快照已生成。'
  })

  const getPdf = async () => {
    setLoading(true)
    try {
      if (!selectedQuote || !selectedVersion) throw new Error('请先选择报价和版本。')
      const result = await api.quotePdf(selectedQuote.id, selectedVersion.id)
      setPdfBytes(result.bytes)
      if (typeof window !== 'undefined') {
        const url = URL.createObjectURL(result.blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
      setNotice({ tone: 'green', text: `PDF 获取成功：${result.bytes} bytes。` })
    } catch (error) {
      setNotice({ tone: 'amber', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const sendQuote = () => run(async () => {
    if (!selectedQuote || !selectedVersion) throw new Error('请先选择报价和版本。')
    const result = await api.sendQuote(selectedQuote.id, { versionId: selectedVersion.id, channel: 'EMAIL', recipient: quoteForm.recipient, subject: quoteForm.subject || 'NexFab quotation', message: quoteForm.message, confirmedExternalSend: quoteForm.confirmedExternalSend })
    return `人工确认发送已留痕：${result.status}。系统不会代发外部邮件。`
  })

  return (
    <div className="space-y-5" data-testid="p1-product-quote-view">
      <div className={cn('rounded-xl border p-4 text-[13px] leading-6', toneClass(notice.tone))}>
        <div className="flex items-start gap-2">
          {notice.tone === 'green' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <div><b>P1.2 产品与确定性报价：</b>{active.moduleName} / {active.subName} · {notice.text}</div>
          <Button className="ml-auto shrink-0" variant="secondary" size="sm" onClick={() => void refresh('列表已刷新。')} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="产品" value={products.length} hint="/api/products" />
        <Kpi title="资料" value={productDocs.length} hint="TDS/SDS/CERT 状态" />
        <Kpi title="客户" value={customers.length} hint="报价客户由后端读取" />
        <Kpi title="报价" value={quotes.length} hint="版本/锁定/发送" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>1. 产品库与资料状态</CardTitle><Badge tone="blue">PIM API</Badge></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Field label="新分类名称"><Input value={productForm.categoryName} onChange={(e) => setProductForm({ ...productForm, categoryName: e.target.value })} placeholder="用户输入分类" /></Field>
                <Button className="self-end" variant="secondary" onClick={createCategory} disabled={loading}>创建分类</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="产品分类"><select className={inputClass} value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}><option value="">选择后端分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <Field label="SKU"><Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })} placeholder="用户输入 SKU" /></Field>
                <Field label="产品名称"><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="用户输入产品名称" /></Field>
                <label className="flex items-center gap-2 pt-6 text-xs text-slate-600"><input type="checkbox" checked={productForm.active} onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })} />启用产品</label>
                <Field label="规格 JSON"><textarea className={textareaClass} value={productForm.specsJson} onChange={(e) => setProductForm({ ...productForm, specsJson: e.target.value })} /></Field>
                <Field label="包装 JSON"><textarea className={textareaClass} value={productForm.packingJson} onChange={(e) => setProductForm({ ...productForm, packingJson: e.target.value })} /></Field>
                <Field label="成本版本 JSON"><textarea className={textareaClass} value={productForm.costJson} onChange={(e) => setProductForm({ ...productForm, costJson: e.target.value })} /></Field>
              </div>
              <Button onClick={createProduct} disabled={loading}><PackagePlus className="h-4 w-4" />创建产品</Button>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="资料产品"><select className={inputClass} value={docForm.productId} onChange={(e) => setDocForm({ ...docForm, productId: e.target.value })}><option value="">选择产品</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></Field>
                  <Field label="资料类型"><select className={inputClass} value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}><option>TDS</option><option>SDS</option><option>CERT</option></select></Field>
                  <Field label="资料状态"><select className={inputClass} value={docForm.status} onChange={(e) => setDocForm({ ...docForm, status: e.target.value })}><option>DRAFT</option><option>REVIEWED</option><option>EXPIRED</option></select></Field>
                  <Field label="有效期"><Input type="date" value={docForm.validUntil} onChange={(e) => setDocForm({ ...docForm, validUntil: e.target.value })} /></Field>
                  <Field label="文件链接"><Input value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="用户输入资料 URL" /></Field>
                </div>
                <Button className="mt-3" variant="secondary" onClick={createProductDoc} disabled={loading}>保存资料状态</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>产品 / 资料列表</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              {products.length ? products.slice(0, 6).map((item) => <div key={item.id} className="rounded-lg bg-slate-50 px-3 py-2"><b>{item.sku}</b> · {item.name} · docs {item._count?.docs || 0}</div>) : <Empty text="暂无产品。请先创建分类和产品，或等待后端数据加载。" />}
              <div className="h-px bg-line" />
              {productDocs.length ? productDocs.slice(0, 4).map((item) => <div key={item.id} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">{item.type} · {item.status} · {item.fileUrl}</div>) : <Empty text="当前选中产品暂无资料状态。" />}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>2. 快速报价与规则预览</CardTitle><Badge tone="amber">确定性计算</Badge></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="客户"><select className={inputClass} value={calcForm.customerId} onChange={(e) => setCalcForm({ ...calcForm, customerId: e.target.value })}><option value="">选择后端客户</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <Field label="产品"><select className={inputClass} value={calcForm.productId} onChange={(e) => setCalcForm({ ...calcForm, productId: e.target.value })}><option value="">选择后端产品</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></Field>
                <Field label="数量"><Input value={calcForm.quantity} onChange={(e) => setCalcForm({ ...calcForm, quantity: e.target.value })} placeholder="用户输入数量" /></Field>
                <Field label="贸易术语"><select className={inputClass} value={calcForm.tradeTerm} onChange={(e) => setCalcForm({ ...calcForm, tradeTerm: e.target.value as CalcForm['tradeTerm'] })}><option>EXW</option><option>FOB</option><option>CIF</option><option>DDP</option></select></Field>
                <Field label="币种"><Input value={calcForm.currency} maxLength={3} onChange={(e) => setCalcForm({ ...calcForm, currency: e.target.value.toUpperCase() })} /></Field>
                <Field label="汇率 CNY/USD"><Input value={calcForm.fxRateCnyPerUsd} onChange={(e) => setCalcForm({ ...calcForm, fxRateCnyPerUsd: e.target.value })} placeholder="空值使用后端默认" /></Field>
                <Field label="目标毛利率"><Input value={calcForm.marginRate} onChange={(e) => setCalcForm({ ...calcForm, marginRate: e.target.value })} placeholder="如 0.3" /></Field>
                <Field label="最低毛利率"><Input value={calcForm.minimumMarginRate} onChange={(e) => setCalcForm({ ...calcForm, minimumMarginRate: e.target.value })} placeholder="如 0.15" /></Field>
                <Field label="国际运费 USD"><Input value={calcForm.internationalFreightUsd} onChange={(e) => setCalcForm({ ...calcForm, internationalFreightUsd: e.target.value })} /></Field>
                <Field label="目的港杂费 USD"><Input value={calcForm.destinationPortChargesUsd} onChange={(e) => setCalcForm({ ...calcForm, destinationPortChargesUsd: e.target.value })} /></Field>
                <Field label="清关费 USD"><Input value={calcForm.customsClearanceUsd} onChange={(e) => setCalcForm({ ...calcForm, customsClearanceUsd: e.target.value })} /></Field>
                <Field label="关税率"><Input value={calcForm.dutyRate} onChange={(e) => setCalcForm({ ...calcForm, dutyRate: e.target.value })} placeholder="如 0.05" /></Field>
                <Field label="派送费 USD"><Input value={calcForm.deliveryFeeUsd} onChange={(e) => setCalcForm({ ...calcForm, deliveryFeeUsd: e.target.value })} /></Field>
              </div>
              <div className="flex flex-wrap gap-2"><Button onClick={() => void calculate()} disabled={loading}><ShieldAlert className="h-4 w-4" />计算报价</Button><Button variant="secondary" onClick={createQuickQuote} disabled={loading || !calculation}>用计算结果创建报价</Button></div>
              <CalculationPanel calculation={calculation} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>3. 报价版本 / PDF / 发送留痕</CardTitle><Badge tone="purple">人工确认</Badge></CardHeader>
            <CardContent className="space-y-4">
              <Field label="报价单"><select className={inputClass} value={selectedQuoteId} onChange={(e) => { setSelectedQuoteId(e.target.value); setVersions([]) }}><option value="">选择报价</option>{quotes.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.status} · {item.currency} {money(item.totalAmount)}</option>)}</select></Field>
              {selectedQuoteId ? <Button variant="secondary" size="sm" onClick={() => void run(async () => { const list = await api.quoteVersions(selectedQuoteId, 'pageSize=8'); setVersions(list.items); return `已加载 ${list.items.length} 个报价版本。` })}>加载版本</Button> : null}
              {selectedVersion ? <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6">版本 V{selectedVersion.version} · 锁定状态 <b>{selectedVersion.lockStatus || 'UNLOCKED'}</b> · 金额 {money(selectedVersion.totalAmount)} · 毛利 {money(selectedVersion.grossMargin)}</div> : <Empty text="暂无报价版本。先创建报价或选择已有报价。" />}
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="锁定最低毛利率"><Input value={quoteForm.minimumMarginRate} onChange={(e) => setQuoteForm({ ...quoteForm, minimumMarginRate: e.target.value })} /></Field>
                <Field label="报价有效期（天）"><Input value={quoteForm.validityDays} onChange={(e) => setQuoteForm({ ...quoteForm, validityDays: e.target.value })} /></Field>
              </div>
              <div className="flex flex-wrap gap-2"><Button onClick={lockVersion} disabled={loading || !selectedVersion}><Lock className="h-4 w-4" />锁定 / 触发审批</Button><Button variant="secondary" onClick={() => void getPdf()} disabled={loading || !selectedVersion}><FileText className="h-4 w-4" />获取 PDF</Button></div>
              {pdfBytes != null ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">最近一次 PDF：{pdfBytes} bytes</div> : null}

              <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                <Field label="收件人"><Input value={quoteForm.recipient} onChange={(e) => setQuoteForm({ ...quoteForm, recipient: e.target.value })} placeholder="用户输入收件人" /></Field>
                <Field label="主题"><Input value={quoteForm.subject} onChange={(e) => setQuoteForm({ ...quoteForm, subject: e.target.value })} placeholder="用户输入主题" /></Field>
                <label className="space-y-1.5 text-xs font-medium text-slate-500 md:col-span-2"><span>发送说明</span><textarea className={textareaClass} value={quoteForm.message} onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })} /></label>
                <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-2"><input type="checkbox" checked={quoteForm.confirmedExternalSend} onChange={(e) => setQuoteForm({ ...quoteForm, confirmedExternalSend: e.target.checked })} />已人工确认外部发送；系统仅留痕，不代发邮件</label>
              </div>
              <Button onClick={sendQuote} disabled={loading || !selectedVersion}><Send className="h-4 w-4" />记录人工发送</Button>

              <ListBlock title="报价列表" items={quotes.map((item) => `${item.status} · ${item.currency} ${money(item.totalAmount)} · versions ${item._count?.versions || item.versions?.length || 0}`)} empty="暂无报价。" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kpi({ title, value, hint }: { title: string; value: number; hint: string }) {
  return <Card><CardContent><div className="text-xs text-muted">{title}</div><div className="mt-2 text-2xl font-semibold text-ink">{value}</div><div className="mt-1 text-[11px] text-slate-400">{hint}</div></CardContent></Card>
}

function CalculationPanel({ calculation }: { calculation: QuoteCalculationResult | null }) {
  if (!calculation) return <Empty text="尚未计算。请选择后端客户/产品并输入数量、规则费用。" />
  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{calculation.tradeTerm}</Badge><Badge tone={calculation.approval.required ? 'red' : 'blue'}>{calculation.approval.required ? '需审批' : '可锁定'}</Badge><span>币种 {calculation.currency}</span><span>汇率 {calculation.ruleSet.fxRateCnyPerUsd}</span></div>
      <div className="grid gap-2 md:grid-cols-4">
        <Mini label="成本" value={money(calculation.totals.costTotal)} />
        <Mini label="选中条款金额" value={money(calculation.totals.selectedTotal)} />
        <Mini label="单价" value={money(calculation.totals.selectedUnitPrice)} />
        <Mini label="毛利率" value={percent(calculation.totals.grossMarginRate)} />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <Mini label="EXW" value={money(calculation.totals.exwTotal)} />
        <Mini label="FOB" value={money(calculation.totals.fobTotal)} />
        <Mini label="CIF" value={money(calculation.totals.cifTotal)} />
        <Mini label="DDP" value={money(calculation.totals.ddpTotal)} />
        <Mini label="关税" value={money(calculation.charges.dutyUsd)} />
        <Mini label="派送费" value={money(calculation.charges.deliveryFeeUsd)} />
      </div>
      {calculation.lines.map((line) => <div key={line.lineNo} className="rounded-lg bg-slate-50 px-3 py-2">{line.sku} · {line.name} · 数量 {line.quantity} · 单位成本 CNY {money(line.unitCostCny)} · 包装 CNY {money(line.packagingCostCny)}</div>)}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">{label}</div><b className="text-slate-700">{value}</b></div>
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div className="space-y-2 text-xs"><div className="flex items-center justify-between"><b>{title}</b><Badge>{items.length}</Badge></div>{items.length ? items.slice(0, 5).map((item, index) => <div key={`${title}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{item}</div>) : <Empty text={empty} />}</div>
}
