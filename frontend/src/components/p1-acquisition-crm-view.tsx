'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, GitMerge, RefreshCw, Search, Send, UserPlus } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, DedupeResult, Inquiry, Lead, Opportunity } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ActivePage = { moduleId: string; moduleName: string; subName: string }
type NoticeTone = 'blue' | 'red' | 'amber' | 'green'
type Notice = { tone: NoticeTone; text: string }

type LeadForm = {
  source: string
  channel: string
  companyName: string
  contactName: string
  email: string
  phone: string
  country: string
  language: string
  productName: string
  quantity: string
  priority: string
}

type InquiryForm = {
  leadId: string
  subject: string
  content: string
  productName: string
  quantity: string
  tradeTerm: string
}

type CustomerForm = { name: string; country: string; website: string; duplicateCheckConfirmed: boolean }
type ContactForm = { customerId: string; name: string; title: string; email: string; phone: string }
type OpportunityForm = { customerId: string; name: string; amount: string; currency: string }
type FollowUpForm = { opportunityId: string; type: string; content: string; dueAt: string }
type DedupeForm = { companyName: string; email: string; phone: string }
type ConvertForm = { leadId: string; opportunityName: string; amount: string; currency: string; duplicateCheckConfirmed: boolean }

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[88px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const selectClass = inputClass

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  if (error instanceof Error) return error.message
  return '操作失败，请检查后端服务。'
}

function asNumber(value: string) {
  if (!value.trim()) return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : value
}

function toneClass(tone: NoticeTone) {
  return {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[tone]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>{label}</span>{children}</label>
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">{text}</div>
}

export function P1AcquisitionCrmView({ active }: { active: ActivePage }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [dedupeResult, setDedupeResult] = useState<DedupeResult | null>(null)
  const [notice, setNotice] = useState<Notice>({ tone: 'blue', text: 'P1.1 页面已接入真实后端 API；去重、权限、审计、转客户均由后端执行。' })
  const [loading, setLoading] = useState(false)

  const [leadForm, setLeadForm] = useState<LeadForm>({ source: 'manual', channel: '', companyName: '', contactName: '', email: '', phone: '', country: '', language: '', productName: '', quantity: '', priority: 'normal' })
  const [inquiryForm, setInquiryForm] = useState<InquiryForm>({ leadId: '', subject: '', content: '', productName: '', quantity: '', tradeTerm: 'DDP' })
  const [customerForm, setCustomerForm] = useState<CustomerForm>({ name: '', country: '', website: '', duplicateCheckConfirmed: false })
  const [contactForm, setContactForm] = useState<ContactForm>({ customerId: '', name: '', title: '', email: '', phone: '' })
  const [opportunityForm, setOpportunityForm] = useState<OpportunityForm>({ customerId: '', name: '', amount: '', currency: 'USD' })
  const [followUpForm, setFollowUpForm] = useState<FollowUpForm>({ opportunityId: '', type: 'note', content: '', dueAt: '' })
  const [dedupeForm, setDedupeForm] = useState<DedupeForm>({ companyName: '', email: '', phone: '' })
  const [convertForm, setConvertForm] = useState<ConvertForm>({ leadId: '', opportunityName: '', amount: '', currency: 'USD', duplicateCheckConfirmed: false })

  const currentLead = useMemo(() => leads.find((item) => item.id === convertForm.leadId || item.id === inquiryForm.leadId) || leads[0], [leads, convertForm.leadId, inquiryForm.leadId])
  const currentCustomer = useMemo(() => customers.find((item) => item.id === contactForm.customerId || item.id === opportunityForm.customerId) || customers[0], [customers, contactForm.customerId, opportunityForm.customerId])
  const currentOpportunity = useMemo(() => opportunities.find((item) => item.id === followUpForm.opportunityId) || opportunities[0], [opportunities, followUpForm.opportunityId])

  async function refresh(message?: string) {
    setLoading(true)
    try {
      const [leadList, inquiryList, customerList, opportunityList] = await Promise.all([
        api.leads('pageSize=8'),
        api.inquiries('pageSize=8'),
        api.customers('pageSize=8'),
        api.opportunities('pageSize=8'),
      ])
      setLeads(leadList.items)
      setInquiries(inquiryList.items)
      setCustomers(customerList.items)
      setOpportunities(opportunityList.items)
      if (message) setNotice({ tone: 'green', text: message })
      const firstLeadId = leadList.items[0]?.id || ''
      const firstCustomerId = customerList.items[0]?.id || ''
      const firstOpportunityId = opportunityList.items[0]?.id || ''
      setInquiryForm((old) => ({ ...old, leadId: old.leadId || firstLeadId }))
      setConvertForm((old) => ({ ...old, leadId: old.leadId || firstLeadId }))
      setContactForm((old) => ({ ...old, customerId: old.customerId || firstCustomerId }))
      setOpportunityForm((old) => ({ ...old, customerId: old.customerId || firstCustomerId }))
      setFollowUpForm((old) => ({ ...old, opportunityId: old.opportunityId || firstOpportunityId }))
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function run(action: () => Promise<string>) {
    setLoading(true)
    try {
      const message = await action()
      await refresh(message)
    } catch (error) {
      setNotice({ tone: error instanceof ApiError && error.status === 409 ? 'amber' : 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const createLead = () => run(async () => {
    const lead = await api.createLead({
      source: leadForm.source,
      channel: leadForm.channel,
      companyName: leadForm.companyName,
      contactName: leadForm.contactName,
      email: leadForm.email,
      phone: leadForm.phone,
      country: leadForm.country,
      language: leadForm.language,
      productInterest: { products: [leadForm.productName], quantity: leadForm.quantity },
      priority: leadForm.priority,
    })
    setInquiryForm((old) => ({ ...old, leadId: lead.id }))
    setConvertForm((old) => ({ ...old, leadId: lead.id, opportunityName: `${lead.companyName} 询盘商机` }))
    return `已创建线索 ${lead.code || lead.id}，可继续登记询盘或查重转客户。`
  })

  const createInquiry = () => run(async () => {
    const inquiry = await api.createInquiry({
      leadId: inquiryForm.leadId || currentLead?.id,
      subject: inquiryForm.subject,
      content: inquiryForm.content,
      source: 'website',
      channel: 'form',
      requirements: { tradeTerms: [inquiryForm.tradeTerm], source: active.subName },
      missingFields: { voltage: true, certification: true },
      aiExtracted: false,
      items: [{ productName: inquiryForm.productName, quantity: asNumber(inquiryForm.quantity), unit: 'pcs' }],
    })
    await api.updateInquiryStatus(inquiry.id, 'quoting')
    return `询盘 ${inquiry.code || inquiry.id} 已创建并进入 QUOTING，下一步可进入报价中心。`
  })

  const createCustomer = () => run(async () => {
    const customer = await api.createCustomer({ ...customerForm, duplicateCheckConfirmed: customerForm.duplicateCheckConfirmed })
    setContactForm((old) => ({ ...old, customerId: customer.id }))
    setOpportunityForm((old) => ({ ...old, customerId: customer.id }))
    return `已创建客户 ${customer.name}，后端同步写入客户指纹与审计。`
  })

  const createContact = () => run(async () => {
    const customerId = contactForm.customerId || currentCustomer?.id
    if (!customerId) throw new Error('请先选择或创建客户。')
    const contact = await api.createContact(customerId, { name: contactForm.name, title: contactForm.title, email: contactForm.email, phone: contactForm.phone })
    return `已新增联系人 ${contact.name}，PII 加密/指纹由后端处理。`
  })

  const createOpportunity = () => run(async () => {
    const customerId = opportunityForm.customerId || currentCustomer?.id
    if (!customerId) throw new Error('请先选择或创建客户。')
    const opportunity = await api.createOpportunity({ customerId, name: opportunityForm.name, amount: asNumber(opportunityForm.amount), currency: opportunityForm.currency })
    setFollowUpForm((old) => ({ ...old, opportunityId: opportunity.id }))
    return `已创建商机 ${opportunity.name}，可继续写入跟进。`
  })

  const createFollowUp = () => run(async () => {
    const opportunityId = followUpForm.opportunityId || currentOpportunity?.id
    if (!opportunityId) throw new Error('请先选择或创建商机。')
    const follow = await api.createOpportunityFollowUp(opportunityId, { type: followUpForm.type, content: followUpForm.content, dueAt: followUpForm.dueAt || undefined })
    return `已新增商机跟进 ${follow.type}，AuditLog 已由后端记录。`
  })

  const dedupe = async () => {
    setLoading(true)
    try {
      const result = await api.dedupe(dedupeForm)
      setDedupeResult(result)
      setNotice({ tone: result.hasDuplicates ? 'amber' : 'green', text: result.hasDuplicates ? `发现 ${result.candidates.length} 个可见重复候选，需人工确认。` : '未发现可见重复候选，可继续建档。' })
    } catch (error) {
      setNotice({ tone: 'red', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const convertLead = () => run(async () => {
    const leadId = convertForm.leadId || currentLead?.id
    if (!leadId) throw new Error('请先选择或创建线索。')
    const result = await api.convertLead(leadId, { opportunityName: convertForm.opportunityName, amount: asNumber(convertForm.amount), currency: convertForm.currency, duplicateCheckConfirmed: convertForm.duplicateCheckConfirmed })
    setContactForm((old) => ({ ...old, customerId: result.customer.id }))
    if (result.opportunity?.id) setFollowUpForm((old) => ({ ...old, opportunityId: result.opportunity?.id || old.opportunityId }))
    return `线索已转客户 ${result.customer.name}${result.opportunity ? `，并生成商机 ${result.opportunity.name}` : ''}。`
  })

  return (
    <div className="space-y-5" data-testid="p1-acquisition-crm-view">
      <div className={cn('rounded-xl border p-4 text-[13px] leading-6', toneClass(notice.tone))}>
        <div className="flex items-start gap-2">
          {notice.tone === 'green' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <div><b>P1.1 获客到客户跟进闭环：</b>{notice.text}</div>
          <Button className="ml-auto shrink-0" variant="secondary" size="sm" onClick={() => void refresh('列表已刷新。')} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="线索" value={leads.length} hint="Lead / 公海分配 / 查重" />
        <Kpi title="询盘" value={inquiries.length} hint="Inquiry / 商品需求" />
        <Kpi title="客户" value={customers.length} hint="Customer / Contact" />
        <Kpi title="商机" value={opportunities.length} hint="Opportunity / Follow-up" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>1. 线索 / 询盘录入</CardTitle><Badge tone="blue">复用 acquisition-routes</Badge></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="来源"><select className={selectClass} value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}><option value="website">官网</option><option value="exhibition">展会</option><option value="b2b">B2B</option><option value="referral">转介绍</option></select></Field>
                <Field label="渠道"><Input value={leadForm.channel} onChange={(e) => setLeadForm({ ...leadForm, channel: e.target.value })} /></Field>
                <Field label="优先级"><select className={selectClass} value={leadForm.priority} onChange={(e) => setLeadForm({ ...leadForm, priority: e.target.value })}><option value="normal">normal</option><option value="high">high</option><option value="low">low</option></select></Field>
                <Field label="公司"><Input value={leadForm.companyName} onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })} /></Field>
                <Field label="联系人"><Input value={leadForm.contactName} onChange={(e) => setLeadForm({ ...leadForm, contactName: e.target.value })} /></Field>
                <Field label="邮箱"><Input value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} /></Field>
                <Field label="电话"><Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} /></Field>
                <Field label="国家"><Input value={leadForm.country} onChange={(e) => setLeadForm({ ...leadForm, country: e.target.value })} /></Field>
                <Field label="语言"><Input value={leadForm.language} onChange={(e) => setLeadForm({ ...leadForm, language: e.target.value })} /></Field>
                <Field label="产品"><Input value={leadForm.productName} onChange={(e) => setLeadForm({ ...leadForm, productName: e.target.value })} /></Field>
                <Field label="数量"><Input value={leadForm.quantity} onChange={(e) => setLeadForm({ ...leadForm, quantity: e.target.value })} /></Field>
              </div>
              <div className="flex flex-wrap gap-2"><Button onClick={createLead} disabled={loading}><UserPlus className="h-4 w-4" />创建线索</Button></div>

              <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                <Field label="绑定线索"><select className={selectClass} value={inquiryForm.leadId} onChange={(e) => setInquiryForm({ ...inquiryForm, leadId: e.target.value })}><option value="">选择线索</option>{leads.map((lead) => <option value={lead.id} key={lead.id}>{lead.companyName} · {lead.status}</option>)}</select></Field>
                <Field label="贸易条款"><select className={selectClass} value={inquiryForm.tradeTerm} onChange={(e) => setInquiryForm({ ...inquiryForm, tradeTerm: e.target.value })}><option>FOB</option><option>CIF</option><option>DDP</option><option>EXW</option></select></Field>
                <Field label="询盘主题"><Input value={inquiryForm.subject} onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })} /></Field>
                <Field label="询盘产品"><Input value={inquiryForm.productName} onChange={(e) => setInquiryForm({ ...inquiryForm, productName: e.target.value })} /></Field>
                <Field label="询盘数量"><Input value={inquiryForm.quantity} onChange={(e) => setInquiryForm({ ...inquiryForm, quantity: e.target.value })} /></Field>
                <label className="space-y-1.5 text-xs font-medium text-slate-500 md:col-span-2"><span>询盘内容</span><textarea className={textareaClass} value={inquiryForm.content} onChange={(e) => setInquiryForm({ ...inquiryForm, content: e.target.value })} /></label>
              </div>
              <Button variant="secondary" onClick={createInquiry} disabled={loading}><Send className="h-4 w-4" />登记询盘并进入 QUOTING</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>2. 查重 / 转客户 / 建商机</CardTitle><Badge tone="amber">人工确认</Badge></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="查重公司"><Input value={dedupeForm.companyName} onChange={(e) => setDedupeForm({ ...dedupeForm, companyName: e.target.value })} /></Field>
                <Field label="查重邮箱"><Input value={dedupeForm.email} onChange={(e) => setDedupeForm({ ...dedupeForm, email: e.target.value })} /></Field>
                <Field label="查重电话"><Input value={dedupeForm.phone} onChange={(e) => setDedupeForm({ ...dedupeForm, phone: e.target.value })} /></Field>
              </div>
              <Button variant="secondary" onClick={() => void dedupe()} disabled={loading}><Search className="h-4 w-4" />客户指纹查重</Button>
              {dedupeResult ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">可见候选：{dedupeResult.candidates.length}；隐藏越权候选：{dedupeResult.hiddenCount || 0}；{dedupeResult.hasDuplicates ? '需要人工确认后再继续。' : '可继续建档。'}</div> : null}

              <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                <Field label="待转线索"><select className={selectClass} value={convertForm.leadId} onChange={(e) => setConvertForm({ ...convertForm, leadId: e.target.value })}><option value="">选择线索</option>{leads.map((lead) => <option value={lead.id} key={lead.id}>{lead.companyName} · {lead.status}</option>)}</select></Field>
                <Field label="商机名称"><Input value={convertForm.opportunityName} onChange={(e) => setConvertForm({ ...convertForm, opportunityName: e.target.value })} /></Field>
                <Field label="金额"><Input value={convertForm.amount} onChange={(e) => setConvertForm({ ...convertForm, amount: e.target.value })} /></Field>
                <Field label="币种"><Input value={convertForm.currency} maxLength={3} onChange={(e) => setConvertForm({ ...convertForm, currency: e.target.value.toUpperCase() })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={convertForm.duplicateCheckConfirmed} onChange={(e) => setConvertForm({ ...convertForm, duplicateCheckConfirmed: e.target.checked })} />已完成人工查重确认</label>
              <Button onClick={convertLead} disabled={loading}><GitMerge className="h-4 w-4" />线索转客户 / 商机</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>3. 客户 / 联系人 / 跟进</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="客户名称"><Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} /></Field>
                <Field label="国家"><Input value={customerForm.country} onChange={(e) => setCustomerForm({ ...customerForm, country: e.target.value })} /></Field>
                <Field label="官网"><Input value={customerForm.website} onChange={(e) => setCustomerForm({ ...customerForm, website: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={customerForm.duplicateCheckConfirmed} onChange={(e) => setCustomerForm({ ...customerForm, duplicateCheckConfirmed: e.target.checked })} />重复客户已人工确认</label>
              <Button variant="secondary" onClick={createCustomer} disabled={loading}>新建客户</Button>

              <div className="h-px bg-line" />
              <Field label="选择客户"><select className={selectClass} value={contactForm.customerId} onChange={(e) => { setContactForm({ ...contactForm, customerId: e.target.value }); setOpportunityForm({ ...opportunityForm, customerId: e.target.value }) }}><option value="">选择客户</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="联系人"><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} /></Field>
                <Field label="职位"><Input value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} /></Field>
                <Field label="邮箱"><Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></Field>
                <Field label="电话"><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></Field>
              </div>
              <Button variant="secondary" onClick={createContact} disabled={loading}>新增联系人</Button>

              <div className="h-px bg-line" />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="商机客户"><select className={selectClass} value={opportunityForm.customerId} onChange={(e) => setOpportunityForm({ ...opportunityForm, customerId: e.target.value })}><option value="">选择客户</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></Field>
                <Field label="商机名称"><Input value={opportunityForm.name} onChange={(e) => setOpportunityForm({ ...opportunityForm, name: e.target.value })} /></Field>
                <Field label="金额"><Input value={opportunityForm.amount} onChange={(e) => setOpportunityForm({ ...opportunityForm, amount: e.target.value })} /></Field>
                <Field label="币种"><Input value={opportunityForm.currency} maxLength={3} onChange={(e) => setOpportunityForm({ ...opportunityForm, currency: e.target.value.toUpperCase() })} /></Field>
              </div>
              <Button variant="secondary" onClick={createOpportunity} disabled={loading}>创建商机</Button>

              <div className="grid gap-3 rounded-xl bg-slate-50 p-3">
                <Field label="跟进商机"><select className={selectClass} value={followUpForm.opportunityId} onChange={(e) => setFollowUpForm({ ...followUpForm, opportunityId: e.target.value })}><option value="">选择商机</option>{opportunities.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.stage}</option>)}</select></Field>
                <div className="grid gap-3 md:grid-cols-2"><Field label="跟进类型"><select className={selectClass} value={followUpForm.type} onChange={(e) => setFollowUpForm({ ...followUpForm, type: e.target.value })}><option value="email">email</option><option value="whatsapp">whatsapp</option><option value="call">call</option><option value="meeting">meeting</option><option value="note">note</option></select></Field><Field label="下次时间"><Input type="datetime-local" value={followUpForm.dueAt} onChange={(e) => setFollowUpForm({ ...followUpForm, dueAt: e.target.value })} /></Field></div>
                <label className="space-y-1.5 text-xs font-medium text-slate-500"><span>跟进内容</span><textarea className={textareaClass} value={followUpForm.content} onChange={(e) => setFollowUpForm({ ...followUpForm, content: e.target.value })} /></label>
                <Button onClick={createFollowUp} disabled={loading}>写入跟进记录</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>实时列表</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <ListBlock title="线索" items={leads.map((lead) => `${lead.companyName} · ${lead.status} · ${lead.priority}`)} empty="暂无线索，先创建一条。" />
              <ListBlock title="询盘" items={inquiries.map((item) => `${item.subject} · ${item.status}`)} empty="暂无询盘。" />
              <ListBlock title="客户" items={customers.map((customer) => `${customer.name} · 联系人 ${customer._count?.contacts || 0}`)} empty="暂无客户。" />
              <ListBlock title="商机" items={opportunities.map((item) => `${item.name} · ${item.stage} · ${item.currency}`)} empty="暂无商机。" />
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

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><b>{title}</b><Badge>{items.length}</Badge></div>
      {items.length ? <div className="space-y-1.5">{items.slice(0, 4).map((item, index) => <div key={`${title}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{item}</div>)}</div> : <EmptyLine text={empty} />}
    </div>
  )
}
