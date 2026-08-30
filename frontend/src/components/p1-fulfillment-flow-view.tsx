'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileStack, PackageCheck, RefreshCw, Truck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, OrderGate, OrderPayment, Product, Quote, ReconciliationResult, SalesOrder, SampleRequest, Shipment, TradeDocument } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type NoticeTone = 'blue' | 'green' | 'amber' | 'red'
type Notice = { tone: NoticeTone; text: string }

type SampleForm = { customerId: string; productId: string; quoteId: string; quantity: string; currency: string; estimatedCost: string; shippingAddress: string; note: string; courier: string; trackingNo: string; feedbackComment: string }
type OrderForm = { quoteId: string; orderId: string }
type PaymentForm = { orderId: string; paymentId: string; amount: string; currency: string; receivedAt: string; note: string }
type DocumentForm = { orderId: string; documentId: string; type: 'PI' | 'CI' | 'PL' | 'SC'; templateCode: string; note: string; reviewNote: string }
type ShipmentForm = { orderId: string; shipmentId: string; transportMode: string; carrier: string; trackingNo: string; bookingNo: string; billOfLadingNo: string; containerNo: string; etd: string; atd: string; eta: string; deliveredAt: string; note: string }

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[82px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const sampleStatuses = ['REQUESTED', 'APPROVED', 'SENT', 'DELIVERED', 'FEEDBACK_RECEIVED', 'CONVERTED', 'CANCELLED']
const milestones = ['样品申请', '样品批准', '样品寄出', '样品签收', '反馈通过', '转订单', '回款确认', '单证审核', '待发货', '发货/签收']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>{label}</span>{children}</label>
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">{text}</div>
}
function toneClass(tone: NoticeTone) {
  return { blue: 'border-blue-200 bg-blue-50 text-blue-900', green: 'border-emerald-200 bg-emerald-50 text-emerald-800', amber: 'border-amber-200 bg-amber-50 text-amber-900', red: 'border-red-200 bg-red-50 text-red-800' }[tone]
}
function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}${error.detail ? `｜${JSON.stringify(error.detail)}` : ''}`
  if (error instanceof Error) return error.message
  return '操作失败，请检查后端服务。'
}
function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) throw new Error('数字字段格式不正确。')
  return numberValue
}
function money(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value)
}
function todayOffset(days: number) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}
function isoFromDate(value: string) { return value ? `${value}T00:00:00.000Z` : undefined }

export function P1FulfillmentFlowView({ active }: { active: ActivePage }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [samples, setSamples] = useState<SampleRequest[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [documents, setDocuments] = useState<TradeDocument[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [gate, setGate] = useState<OrderGate | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null)
  const [notice, setNotice] = useState<Notice>({ tone: 'blue', text: 'P1.3 页面接入样品、订单、回款、单证、生产/物流；状态门禁和越权仍由后端决定。' })
  const [loading, setLoading] = useState(false)

  const [sampleForm, setSampleForm] = useState<SampleForm>({ customerId: '', productId: '', quoteId: '', quantity: '', currency: 'USD', estimatedCost: '', shippingAddress: '', note: '', courier: '', trackingNo: '', feedbackComment: '' })
  const [orderForm, setOrderForm] = useState<OrderForm>({ quoteId: '', orderId: '' })
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ orderId: '', paymentId: '', amount: '', currency: 'USD', receivedAt: '', note: '' })
  const [documentForm, setDocumentForm] = useState<DocumentForm>({ orderId: '', documentId: '', type: 'PI', templateCode: 'V2_DEFAULT', note: '', reviewNote: '' })
  // 修复说明：[低危-交互误操作]，原因：物流/签收日期默认预填未来日期，一键提交即产生与实际不符的履约留痕；日期默认留空由用户填写。
  const [shipmentForm, setShipmentForm] = useState<ShipmentForm>({ orderId: '', shipmentId: '', transportMode: 'SEA', carrier: '', trackingNo: '', bookingNo: '', billOfLadingNo: '', containerNo: '', etd: '', atd: '', eta: '', deliveredAt: '', note: '' })

  const selectedSample = useMemo(() => samples[0] || null, [samples])
  const selectedOrder = useMemo(() => orders.find((item) => item.id === orderForm.orderId || item.id === paymentForm.orderId || item.id === documentForm.orderId || item.id === shipmentForm.orderId) || orders[0] || null, [orders, orderForm.orderId, paymentForm.orderId, documentForm.orderId, shipmentForm.orderId])
  const selectedPayment = useMemo(() => payments.find((item) => item.id === paymentForm.paymentId) || payments[0] || null, [payments, paymentForm.paymentId])
  const selectedDocument = useMemo(() => documents.find((item) => item.id === documentForm.documentId) || documents[0] || null, [documents, documentForm.documentId])
  const selectedShipment = useMemo(() => shipments.find((item) => item.id === shipmentForm.shipmentId) || shipments[0] || null, [shipments, shipmentForm.shipmentId])

  const refresh = useCallback(async (message?: string) => {
    setLoading(true)
    try {
      const [customerList, productList, quoteList, sampleList, orderList, paymentList, documentList, shipmentList] = await Promise.all([
        api.customers('pageSize=20'),
        api.products('pageSize=20'),
        api.quotes('pageSize=20'),
        api.samples('pageSize=20'),
        api.orders('pageSize=20'),
        api.payments('pageSize=20'),
        api.tradeDocuments('pageSize=20'),
        api.shipments('pageSize=20'),
      ])
      setCustomers(customerList.items)
      setProducts(productList.items)
      setQuotes(quoteList.items)
      setSamples(sampleList.items)
      setOrders(orderList.items)
      setPayments(paymentList.items)
      setDocuments(documentList.items)
      setShipments(shipmentList.items)
      const firstCustomer = customerList.items[0]?.id || ''
      const firstProduct = productList.items[0]?.id || ''
      const firstQuote = quoteList.items[0]?.id || ''
      const firstOrder = orderList.items[0]?.id || ''
      const firstPayment = paymentList.items[0]?.id || ''
      const firstDocument = documentList.items[0]?.id || ''
      const firstShipment = shipmentList.items[0]?.id || ''
      setSampleForm((old) => ({ ...old, customerId: old.customerId || firstCustomer, productId: old.productId || firstProduct, quoteId: old.quoteId || firstQuote }))
      setOrderForm((old) => ({ quoteId: old.quoteId || firstQuote, orderId: old.orderId || firstOrder }))
      setPaymentForm((old) => ({ ...old, orderId: old.orderId || firstOrder, paymentId: old.paymentId || firstPayment, currency: old.currency || orderList.items[0]?.currency || 'USD' }))
      setDocumentForm((old) => ({ ...old, orderId: old.orderId || firstOrder, documentId: old.documentId || firstDocument }))
      setShipmentForm((old) => ({ ...old, orderId: old.orderId || firstOrder, shipmentId: old.shipmentId || firstShipment }))
      // 修复说明：[中高-状态竞态]，原因：refresh 固定取列表第一单的门禁/对账，会在 loadGate 之后覆盖用户当前选中订单的门禁展示（发货放行判断张冠李戴）；现优先按选中订单加载，并将其纳入依赖使选择变化时门禁联动刷新。
      const gateOrderId = selectedOrder?.id || firstOrder
      if (gateOrderId) {
        const [gateData, reconciliationData] = await Promise.all([
          api.orderGate(gateOrderId).catch(() => null),
          api.reconciliation(gateOrderId).catch(() => null),
        ])
        setGate(gateData)
        setReconciliation(reconciliationData)
      }
      if (message) setNotice({ tone: 'green', text: message })
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }, [selectedOrder?.id])

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

  const createSample = () => run(async () => {
    if (!sampleForm.customerId || !sampleForm.productId) throw new Error('请先选择客户和产品。')
    const sample = await api.createSample({ customerId: sampleForm.customerId, productId: sampleForm.productId, quoteId: sampleForm.quoteId || undefined, quantity: numberOrUndefined(sampleForm.quantity), currency: sampleForm.currency, estimatedCost: numberOrUndefined(sampleForm.estimatedCost), shippingAddress: sampleForm.shippingAddress, note: sampleForm.note })
    return `样品申请已创建：${sample.status}。`
  })
  const updateSampleStatus = (status: string) => run(async () => {
    const sampleId = selectedSample?.id
    if (!sampleId) throw new Error('请先创建或选择样品。')
    const body: Record<string, unknown> = { status }
    if (status === 'SENT') { body.courier = sampleForm.courier; body.trackingNo = sampleForm.trackingNo }
    if (status === 'FEEDBACK_RECEIVED') body.feedback = { result: 'PASSED', approved: true, comment: sampleForm.feedbackComment || '客户认可样品' }
    const sample = await api.updateSampleStatus(sampleId, body)
    return `样品状态已更新：${sample.status}。`
  })
  const convertSample = () => run(async () => {
    if (!selectedSample?.id) throw new Error('请先选择样品。')
    const result = await api.convertSampleToOrder(selectedSample.id)
    return `样品已转订单：${result.order.orderNo}。`
  })
  const orderFromQuote = () => run(async () => {
    const quoteId = orderForm.quoteId || quotes[0]?.id
    if (!quoteId) throw new Error('请先选择报价。')
    const order = await api.createOrderFromQuote(quoteId)
    return `报价已转订单：${order.orderNo}。`
  })
  const loadGate = () => run(async () => {
    const orderId = selectedOrder?.id
    if (!orderId) throw new Error('请先选择订单。')
    const [gateData, reconciliationData] = await Promise.all([api.orderGate(orderId), api.reconciliation(orderId)])
    setGate(gateData)
    setReconciliation(reconciliationData)
    return { tone: gateData.canShip || reconciliationData.readyToShip ? 'green' : 'amber', text: `门禁已刷新：待收 ${money(gateData.pendingAmount)}；发货准备 ${reconciliationData.readyToShip ? '已满足' : reconciliationData.blockers.join(', ')}` }
  })
  const createPayment = () => run(async () => {
    const orderId = paymentForm.orderId || selectedOrder?.id
    if (!orderId) throw new Error('请先选择订单。')
    const payment = await api.createPayment({ orderId, amount: numberOrUndefined(paymentForm.amount), currency: paymentForm.currency, receivedAt: isoFromDate(paymentForm.receivedAt), note: paymentForm.note })
    setPaymentForm((old) => ({ ...old, paymentId: payment.id }))
    return `回款已登记：${payment.status}，等待财务确认。`
  })
  const confirmPayment = () => run(async () => {
    const paymentId = paymentForm.paymentId || selectedPayment?.id
    if (!paymentId) throw new Error('请先选择回款记录。')
    const payment = await api.confirmPayment(paymentId)
    return `财务已确认回款：${payment.status}。`
  })
  const generateDocument = () => run(async () => {
    const orderId = documentForm.orderId || selectedOrder?.id
    if (!orderId) throw new Error('请先选择订单。')
    const document = await api.generateTradeDocument(orderId, { type: documentForm.type, templateCode: documentForm.templateCode, note: documentForm.note })
    setDocumentForm((old) => ({ ...old, documentId: document.id }))
    return `单证已生成：${document.type} ${document.documentNo}。`
  })
  const reviewDocument = () => run(async () => {
    const documentId = documentForm.documentId || selectedDocument?.id
    if (!documentId) throw new Error('请先选择单证。')
    const document = await api.reviewTradeDocument(documentId, { status: 'APPROVED', note: documentForm.reviewNote || '人工审核通过' })
    return `单证已审核：${document.type} ${document.status}。`
  })
  const updateFulfillment = (status: string, note: string) => run(async () => {
    const orderId = shipmentForm.orderId || selectedOrder?.id
    if (!orderId) throw new Error('请先选择订单。')
    const order = await api.updateFulfillmentStatus(orderId, { status, note })
    return `订单履约状态已更新：${order.fulfillmentStatus}。`
  })
  const createShipment = () => run(async () => {
    const orderId = shipmentForm.orderId || selectedOrder?.id
    if (!orderId) throw new Error('请先选择订单。')
    const shipment = await api.createShipment(orderId, { transportMode: shipmentForm.transportMode, carrier: shipmentForm.carrier, trackingNo: shipmentForm.trackingNo, bookingNo: shipmentForm.bookingNo, billOfLadingNo: shipmentForm.billOfLadingNo, containerNo: shipmentForm.containerNo, etd: isoFromDate(shipmentForm.etd), atd: isoFromDate(shipmentForm.atd), eta: isoFromDate(shipmentForm.eta), note: shipmentForm.note })
    setShipmentForm((old) => ({ ...old, shipmentId: shipment.id }))
    return `物流已创建并发货：${shipment.status}。`
  })
  const deliverShipment = () => run(async () => {
    const shipmentId = shipmentForm.shipmentId || selectedShipment?.id
    if (!shipmentId) throw new Error('请先选择物流记录。')
    const shipment = await api.updateShipmentStatus(shipmentId, { status: 'DELIVERED', deliveredAt: isoFromDate(shipmentForm.deliveredAt), note: shipmentForm.note || '客户签收' })
    return `物流已签收：${shipment.status}。`
  })

  return (
    <div className="space-y-5" data-testid="p1-fulfillment-flow-view">
      <div className={cn('rounded-xl border p-4 text-[13px] leading-6', toneClass(notice.tone))}>
        <div className="flex items-start gap-2">
          {notice.tone === 'green' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <div><b>P1.3 无 AI 履约闭环：</b>{active.moduleName} / {active.subName} · {notice.text}</div>
          <Button className="ml-auto shrink-0" variant="secondary" size="sm" onClick={() => void refresh('列表已刷新。')} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {milestones.map((item, index) => <div key={item} className="rounded-lg border border-line bg-white p-2 text-xs"><span className="mr-1 text-slate-400">{index + 1}</span>{item}</div>)}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Kpi title="样品" value={samples.length} hint="申请/状态/反馈" />
        <Kpi title="订单" value={orders.length} hint="报价或样品转单" />
        <Kpi title="回款" value={payments.length} hint="登记/财务确认" />
        <Kpi title="单证" value={documents.length} hint="PI/CI/PL/SC" />
        <Kpi title="物流" value={shipments.length} hint="发货/签收" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(430px,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>1. 样品创建、进度、反馈、转订单</CardTitle><Badge tone="amber">7 状态写入 / 10 里程碑展示</Badge></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="客户"><select className={inputClass} value={sampleForm.customerId} onChange={(e) => setSampleForm({ ...sampleForm, customerId: e.target.value })}><option value="">选择客户</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <Field label="产品"><select className={inputClass} value={sampleForm.productId} onChange={(e) => setSampleForm({ ...sampleForm, productId: e.target.value })}><option value="">选择产品</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></Field>
                <Field label="绑定报价"><select className={inputClass} value={sampleForm.quoteId} onChange={(e) => setSampleForm({ ...sampleForm, quoteId: e.target.value })}><option value="">选择报价</option>{quotes.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.status} · {money(item.totalAmount)}</option>)}</select></Field>
                <Field label="样品数量"><Input value={sampleForm.quantity} onChange={(e) => setSampleForm({ ...sampleForm, quantity: e.target.value })} /></Field>
                <Field label="币种"><Input value={sampleForm.currency} maxLength={3} onChange={(e) => setSampleForm({ ...sampleForm, currency: e.target.value.toUpperCase() })} /></Field>
                <Field label="预计成本"><Input value={sampleForm.estimatedCost} onChange={(e) => setSampleForm({ ...sampleForm, estimatedCost: e.target.value })} /></Field>
              </div>
              <Field label="寄送地址"><textarea className={textareaClass} value={sampleForm.shippingAddress} onChange={(e) => setSampleForm({ ...sampleForm, shippingAddress: e.target.value })} /></Field>
              <Field label="样品备注"><textarea className={textareaClass} value={sampleForm.note} onChange={(e) => setSampleForm({ ...sampleForm, note: e.target.value })} /></Field>
              <Button onClick={createSample} disabled={loading}><PackageCheck className="h-4 w-4" />创建样品申请</Button>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 text-xs text-slate-500">当前样品：{selectedSample ? `${selectedSample.status} · ${selectedSample.customer?.name || selectedSample.customerId}` : '未选择'}</div>
                <div className="grid gap-2 md:grid-cols-3">{sampleStatuses.map((status) => <Button key={status} variant="secondary" size="sm" onClick={() => updateSampleStatus(status)} disabled={loading || !selectedSample}>{status}</Button>)}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="快递/物流"><Input value={sampleForm.courier} onChange={(e) => setSampleForm({ ...sampleForm, courier: e.target.value })} /></Field><Field label="样品运单号"><Input value={sampleForm.trackingNo} onChange={(e) => setSampleForm({ ...sampleForm, trackingNo: e.target.value })} /></Field></div>
                <Field label="反馈说明"><textarea className={textareaClass} value={sampleForm.feedbackComment} onChange={(e) => setSampleForm({ ...sampleForm, feedbackComment: e.target.value })} /></Field>
                <Button className="mt-3" onClick={convertSample} disabled={loading || !selectedSample}>样品反馈通过后转订单</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. 报价转订单与订单门禁</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="报价"><select className={inputClass} value={orderForm.quoteId} onChange={(e) => setOrderForm({ ...orderForm, quoteId: e.target.value })}><option value="">选择报价</option>{quotes.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.status} · {money(item.totalAmount)}</option>)}</select></Field>
              <Button variant="secondary" onClick={orderFromQuote} disabled={loading}>报价转订单</Button>
              <Field label="订单"><select className={inputClass} value={orderForm.orderId} onChange={(e) => { setOrderForm({ ...orderForm, orderId: e.target.value }); setPaymentForm({ ...paymentForm, orderId: e.target.value }); setDocumentForm({ ...documentForm, orderId: e.target.value }); setShipmentForm({ ...shipmentForm, orderId: e.target.value }) }}><option value="">选择订单</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.orderNo} · {item.paymentStatus} · {item.fulfillmentStatus}</option>)}</select></Field>
              <Button onClick={loadGate} disabled={loading || !selectedOrder}><ClipboardCheck className="h-4 w-4" />刷新订单门禁 / 对账</Button>
              <GatePanel gate={gate} reconciliation={reconciliation} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>3. 收款登记与财务确认</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="收款订单"><select className={inputClass} value={paymentForm.orderId} onChange={(e) => setPaymentForm({ ...paymentForm, orderId: e.target.value })}><option value="">选择订单</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.orderNo} · {item.currency} {money(item.totalAmount)}</option>)}</select></Field>
              <div className="grid gap-3 md:grid-cols-2"><Field label="金额"><Input value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></Field><Field label="币种"><Input value={paymentForm.currency} maxLength={3} onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value.toUpperCase() })} /></Field><Field label="收款日期"><Input type="date" value={paymentForm.receivedAt} onChange={(e) => setPaymentForm({ ...paymentForm, receivedAt: e.target.value })} /></Field><Field label="待确认记录"><select className={inputClass} value={paymentForm.paymentId} onChange={(e) => setPaymentForm({ ...paymentForm, paymentId: e.target.value })}><option value="">选择回款</option>{payments.map((item) => <option key={item.id} value={item.id}>{item.status} · {item.currency} {money(item.amount)}</option>)}</select></Field></div>
              <Field label="备注"><textarea className={textareaClass} value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={createPayment} disabled={loading}>登记回款</Button><Button onClick={confirmPayment} disabled={loading}>财务确认</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>4. PI / CI / PL / SC 单证与一致性</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2"><Field label="单证订单"><select className={inputClass} value={documentForm.orderId} onChange={(e) => setDocumentForm({ ...documentForm, orderId: e.target.value })}><option value="">选择订单</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.orderNo}</option>)}</select></Field><Field label="类型"><select className={inputClass} value={documentForm.type} onChange={(e) => setDocumentForm({ ...documentForm, type: e.target.value as DocumentForm['type'] })}><option>PI</option><option>CI</option><option>PL</option><option>SC</option></select></Field><Field label="模板"><Input value={documentForm.templateCode} onChange={(e) => setDocumentForm({ ...documentForm, templateCode: e.target.value })} /></Field><Field label="待审核单证"><select className={inputClass} value={documentForm.documentId} onChange={(e) => setDocumentForm({ ...documentForm, documentId: e.target.value })}><option value="">选择单证</option>{documents.map((item) => <option key={item.id} value={item.id}>{item.type} V{item.version} · {item.status}</option>)}</select></Field></div>
              <Field label="生成/审核备注"><textarea className={textareaClass} value={documentForm.note} onChange={(e) => setDocumentForm({ ...documentForm, note: e.target.value, reviewNote: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={generateDocument} disabled={loading}><FileStack className="h-4 w-4" />生成单证</Button><Button onClick={reviewDocument} disabled={loading}>审核通过</Button></div>
              <ListBlock title="单证列表" items={documents.map((item) => `${item.type} V${item.version} · ${item.status} · ${item.documentNo}`)} empty="暂无单证。" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>5. 生产 / 待发货 / 物流 / 签收</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="履约订单"><select className={inputClass} value={shipmentForm.orderId} onChange={(e) => setShipmentForm({ ...shipmentForm, orderId: e.target.value })}><option value="">选择订单</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.orderNo} · {item.fulfillmentStatus}</option>)}</select></Field>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => updateFulfillment('IN_PRODUCTION', '生产/备货开始')} disabled={loading}>生产/备货</Button><Button variant="secondary" onClick={() => updateFulfillment('READY_TO_SHIP', '质检完成，单证和回款满足待发货')} disabled={loading}>质检完成 / 待发货</Button></div>
              <div className="grid gap-3 md:grid-cols-2"><Field label="运输方式"><Input value={shipmentForm.transportMode} onChange={(e) => setShipmentForm({ ...shipmentForm, transportMode: e.target.value })} /></Field><Field label="承运方"><Input value={shipmentForm.carrier} onChange={(e) => setShipmentForm({ ...shipmentForm, carrier: e.target.value })} /></Field><Field label="跟踪号"><Input value={shipmentForm.trackingNo} onChange={(e) => setShipmentForm({ ...shipmentForm, trackingNo: e.target.value })} /></Field><Field label="订舱号"><Input value={shipmentForm.bookingNo} onChange={(e) => setShipmentForm({ ...shipmentForm, bookingNo: e.target.value })} /></Field><Field label="提单号"><Input value={shipmentForm.billOfLadingNo} onChange={(e) => setShipmentForm({ ...shipmentForm, billOfLadingNo: e.target.value })} /></Field><Field label="柜号"><Input value={shipmentForm.containerNo} onChange={(e) => setShipmentForm({ ...shipmentForm, containerNo: e.target.value })} /></Field><Field label="ETD"><Input type="date" value={shipmentForm.etd} onChange={(e) => setShipmentForm({ ...shipmentForm, etd: e.target.value })} /></Field><Field label="ATD"><Input type="date" value={shipmentForm.atd} onChange={(e) => setShipmentForm({ ...shipmentForm, atd: e.target.value })} /></Field><Field label="ETA"><Input type="date" value={shipmentForm.eta} onChange={(e) => setShipmentForm({ ...shipmentForm, eta: e.target.value })} /></Field><Field label="签收日期"><Input type="date" value={shipmentForm.deliveredAt} onChange={(e) => setShipmentForm({ ...shipmentForm, deliveredAt: e.target.value })} /></Field></div>
              <Field label="物流备注"><textarea className={textareaClass} value={shipmentForm.note} onChange={(e) => setShipmentForm({ ...shipmentForm, note: e.target.value })} /></Field>
              <Field label="物流记录"><select className={inputClass} value={shipmentForm.shipmentId} onChange={(e) => setShipmentForm({ ...shipmentForm, shipmentId: e.target.value })}><option value="">选择物流</option>{shipments.map((item) => <option key={item.id} value={item.id}>{item.status} · {item.bookingNo || item.trackingNo || item.billOfLadingNo || item.id}</option>)}</select></Field>
              <div className="flex flex-wrap gap-2"><Button onClick={createShipment} disabled={loading}><Truck className="h-4 w-4" />创建发货</Button><Button variant="secondary" onClick={deliverShipment} disabled={loading}>签收</Button></div>
              <ListBlock title="物流列表" items={shipments.map((item) => `${item.status} · ${item.transportMode} · ${item.bookingNo || item.trackingNo || item.billOfLadingNo || '无参考号'}`)} empty="暂无物流。" />
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
function GatePanel({ gate, reconciliation }: { gate: OrderGate | null; reconciliation: ReconciliationResult | null }) {
  if (!gate && !reconciliation) return <Empty text="请选择订单后刷新门禁。" />
  return <div className="space-y-2 rounded-xl border border-line bg-white p-3 text-xs"><div className="grid gap-2 md:grid-cols-3">{gate ? <><Mini label="待收款" value={money(gate.pendingAmount)} /><Mini label="回款状态" value={gate.paymentStatus} /><Mini label="履约状态" value={gate.fulfillmentStatus} /></> : null}{reconciliation ? <><Mini label="发货准备" value={reconciliation.readyToShip ? 'READY' : 'BLOCKED'} /><Mini label="已审单证" value={reconciliation.approvedDocumentTypes.join(', ') || '-'} /><Mini label="阻断" value={reconciliation.blockers.join(', ') || '-'} /></> : null}</div></div>
}
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">{label}</div><b className="text-slate-700">{value}</b></div> }
function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div className="space-y-2 text-xs"><div className="flex items-center justify-between"><b>{title}</b><Badge>{items.length}</Badge></div>{items.length ? items.slice(0, 5).map((item, index) => <div key={`${title}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{item}</div>) : <Empty text={empty} />}</div> }
