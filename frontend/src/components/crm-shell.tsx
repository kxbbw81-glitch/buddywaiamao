'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, LayoutDashboard, LogOut, Menu, Sparkles, X } from 'lucide-react'
import { api, ApiError, SESSION_EXPIRED_EVENT } from '@/lib/api'
import type { DashboardData, NavigationData, NavModule, UserSession } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardView } from '@/components/dashboard-view'
import { LoginForm } from '@/components/login-form'
import { P1AcquisitionCrmView } from '@/components/p1-acquisition-crm-view'
import { P1ProductQuoteView } from '@/components/p1-product-quote-view'
import { P1FulfillmentFlowView } from '@/components/p1-fulfillment-flow-view'
import { P1ImportDashboardView } from '@/components/p1-import-dashboard-view'
import { P2AiWorkbenchView } from '@/components/p2-ai-workbench-view'
import { AgentLibraryView } from '@/components/agent-library-view'
import { P3OpsStatusView } from '@/components/p3-ops-status-view'
import { P3SocialAcquisitionView } from '@/components/p3-social-acquisition-view'
import { P3OutboundDraftView } from '@/components/p3-outbound-draft-view'
import { TimelineView } from '@/components/p1-timeline-view'
import { CommissionView } from '@/components/p1-commission-view'
import { CustomerLifecycleView } from '@/components/p1-customer-lifecycle-view'
import { NotAvailableView, AccountAccessView } from '@/components/not-available-view'
import { P3OperationsReportView } from '@/components/p3-operations-report-view'
import { P3ToolsCenterView } from '@/components/p3-tools-center-view'
import { cn } from '@/lib/utils'
import { NexFabMark } from '@/components/nexfab-mark'

const phaseColor: Record<string, string> = {
  blue: 'text-blue-600',
  teal: 'text-teal-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
  gray: 'text-slate-500',
}

function firstActive(nav: NavigationData | null) {
  const navModule = nav?.modules[0]
  const sub = navModule?.subs[0]
  return navModule && sub ? { moduleId: navModule.id, moduleName: navModule.name, subName: sub.name } : null
}

function sidebarIcon(module: NavModule) {
  return <span className={cn('text-xs', phaseColor[module.phase] || 'text-slate-500')}>◼</span>
}

function isP11Route(active: { moduleId: string; subName: string } | null) {
  if (!active) return false
  return (
    (active.moduleId === 'acquisition' && ['线索池', '网站询盘'].includes(active.subName)) ||
    (active.moduleId === 'customer' && active.subName === '客户档案') ||
    (active.moduleId === 'pipeline' && ['销售管道', '跟进任务'].includes(active.subName)) ||
    (active.moduleId === 'tools' && active.subName === '客户去重')
  )
}

function isP12Route(active: { moduleId: string; subName: string } | null) {
  if (!active) return false
  return (
    (active.moduleId === 'product' && ['产品库（PIM）', 'RAG 知识库问答'].includes(active.subName)) ||
    (active.moduleId === 'quote' && ['快速报价', '报价管理'].includes(active.subName))
  )
}

function isP13Route(active: { moduleId: string; subName: string } | null) {
  if (!active) return false
  return (active.moduleId === 'fulfillment' && ['样品管理', '合同订单', '生产跟踪', '物流管理', '单证管理'].includes(active.subName)) || (active.moduleId === 'finance' && active.subName === '订单与回款')
}

function isP14Route(active: { moduleId: string; subName: string } | null) {
  if (!active) return false
  return (active.moduleId === 'dashboard' && ['经营简报', '跟进与管道'].includes(active.subName)) || (active.moduleId === 'acquisition' && active.subName === '渠道分析') || (active.moduleId === 'insight' && ['数据分析', '数据大屏'].includes(active.subName)) || (active.moduleId === 'tools' && ['官网链接登记', '汇率换算'].includes(active.subName))
}

function isP3ToolsRoute(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'tools'
}

function isP21Route(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'aihub'
}

function isAgentLibraryRoute(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'aihub' && ['自定义 Skills', '销售打法', '业务记忆'].includes(active.subName)
}

function isP31Route(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'system'
}

// 修复说明：[P1-台账外]，原因：六个导航入口（客户画像/售后与复购/WhatsApp/社媒私信/沟通时间线/提成与对账）原命中通用占位提示；
// 有真实后端的（时间线/提成）接真实视图，无后端的诚实标注"未接入"，系统管理子页按功能拆分而非统一落运维状态页。
function isTimelineRoute(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'comms' && active.subName === '沟通时间线'
}
function isCommissionRoute(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'finance' && active.subName === '提成与对账'
}
function isAccountRoute(active: { moduleId: string; subName: string } | null) {
  return active?.moduleId === 'system' && active.subName === '账号与权限'
}
function notAvailableInfo(active: { moduleId: string; subName: string } | null): { title: string; reason: string; needed: string } | null {
  if (!active) return null
  if (active.moduleId === 'customer' && active.subName === '客户画像') return {
    title: '客户画像',
    reason: '后端客户画像聚合接口（标签、成交画像、复购统计）尚未提供。',
    needed: '后端画像聚合端点（基于客户、商机、订单、沟通数据聚合）+ 前端画像视图。',
  }
  if (active.moduleId === 'pipeline' && active.subName === '售后与复购') return {
    title: '售后与复购',
    reason: '售后工单与复购提醒的后端模型与端点尚未提供（当前跟进记录可部分覆盖复购动作，见商机跟进）。',
    needed: '后端复购提醒/售后工单模型与端点，接入后可复用商机跟进交互。',
  }
  if (active.moduleId === 'comms' && active.subName === 'WhatsApp') return {
    title: 'WhatsApp',
    reason: 'WhatsApp 渠道接入与消息收发后端尚未提供（沟通时间线可记录人工发生的 WhatsApp 沟通）。',
    needed: '后端 WhatsApp 连接器（需单独授权）+ 消息收发端点；接入前人工沟通可在沟通时间线留痕。',
  }
  return null
}

function isP32Route(active: { moduleId: string; subName: string } | null) {
  // 修复说明：[P1-台账外]，原因：社媒私信后端由社媒台账（互动录入/意图）承载；私信入口复用 P3 社媒视图。
  return active?.moduleId === 'acquisition' && ['社媒运营', '社媒私信'].includes(active.subName)
}
function isP33Route(active: { moduleId: string; subName: string } | null) { return active?.moduleId === 'comms' && active.subName === '邮件管理' }
function isP34Route(active: { moduleId: string; subName: string } | null) { return active?.moduleId === 'insight' && active.subName === '数据分析' }

export function CrmShell() {
  const [user, setUser] = useState<UserSession | null>(null)
  const [navigation, setNavigation] = useState<NavigationData | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<{ moduleId: string; moduleName: string; subName: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const session = await api.session()
      const [nav, dash] = await Promise.all([api.navigation(), api.dashboard()])
      setUser(session.user)
      setNavigation(nav)
      setDashboard(dash)
      setExpanded(new Set(nav.defaultExpanded))
      setActive((old) => old ?? firstActive(nav))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
        setNavigation(null)
        setDashboard(null)
      } else if (err instanceof ApiError) {
        setError(`${err.code}：${err.message}`)
      } else {
        setError('无法连接后端 API。')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  // 修复说明：[中危-会话体验]，原因：业务视图收到 401 只显示错误横幅，会话过期后用户停留在报错页；监听 api 层的全局过期事件统一回登录并提示。
  useEffect(() => {
    function onSessionExpired() {
      setUser(null)
      setNavigation(null)
      setDashboard(null)
      setError('登录已过期，请重新登录。')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [])

  const visibleCount = useMemo(() => navigation?.modules.reduce((sum, item) => sum + item.subs.length, 0) || 0, [navigation])

  async function logout() {
    await api.logout().catch(() => undefined)
    setUser(null)
    setNavigation(null)
    setDashboard(null)
  }

  if (!user && !loading) return <LoginForm onSuccess={load} />

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f5f6f8] text-ink">
      <header className="relative z-30 flex h-[56px] items-center justify-between border-b border-line bg-white px-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <Button className="sm:hidden" variant="ghost" size="sm" onClick={() => setMobileNavOpen(true)} aria-label="打开导航"><Menu className="h-4 w-4" /></Button>
          <NexFabMark iconClassName="h-[34px] w-[34px] rounded-xl" />
          <span className="text-[13px] font-semibold sm:text-[15px]">NexFab AI 外贸 CRM</span>
          <span className="hidden rounded-full bg-active px-2 py-0.5 text-[11px] font-medium text-brand sm:inline">V2.0</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted sm:gap-3">
          {user ? <span className="hidden sm:inline">{user.name} · {navigation?.roleName || user.role}</span> : <span>加载会话...</span>}
          {user ? <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" />退出</Button> : null}
        </div>
      </header>
      <main className="relative flex h-[calc(100dvh-56px)]">
        {mobileNavOpen ? <button className="absolute inset-0 z-10 bg-slate-950/35 sm:hidden" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)} /> : null}
        <aside className={cn('z-20 flex w-[232px] shrink-0 flex-col border-r border-line bg-white transition-[width,transform] max-md:w-[214px] max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:w-[min(82vw,280px)] max-sm:shadow-xl', mobileNavOpen ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full')}><div className="flex items-center justify-between border-b border-line px-3 py-2 sm:hidden"><b className="text-sm">业务导航</b><Button variant="ghost" size="sm" onClick={() => setMobileNavOpen(false)} aria-label="关闭导航"><X className="h-4 w-4" /></Button></div><div className="nexfab-scroll flex-1 overflow-y-auto p-2">
          {navigation?.modules.map((navModule) => {
            const open = expanded.has(navModule.id)
            return (
              <div key={navModule.id} className="mb-[3px]">
                <button
                  className={cn('relative flex w-full select-none items-center gap-2.5 rounded-lg px-3 py-[9px] text-left text-slate-700 transition-colors hover:bg-[#f3f4f6]', open && 'bg-[#f8fafc]')}
                  onClick={() => setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(navModule.id)) {
                      next.delete(navModule.id)
                    } else {
                      next.add(navModule.id)
                    }
                    return next
                  })}
                >
                  {sidebarIcon(navModule)}
                  <b className="flex-1 text-[13px] font-medium">{navModule.name}</b>
                  {navModule.badge ? <Badge tone={navModule.badge.type}>{navModule.badge.n}</Badge> : null}
                  <ChevronRight className={cn('h-4 w-4 text-slate-400 transition', open && 'rotate-90')} />
                </button>
                <div className={cn('mt-px hidden overflow-hidden', open && 'block')}>
                  {navModule.subs.map((sub) => {
                    const selected = active?.moduleId === navModule.id && active.subName === sub.name
                    return (
                      <button
                        key={sub.name}
                        className={cn('mx-1 my-px flex w-[calc(100%-12px)] items-center gap-1.5 rounded-md py-1.5 pl-10 pr-3 text-left text-xs text-muted transition hover:bg-[#f3f4f6] hover:text-slate-700', selected && 'bg-active font-medium text-brand')}
                        onClick={() => { setActive({ moduleId: navModule.id, moduleName: navModule.name, subName: sub.name }); setMobileNavOpen(false) }}
                      >
                        <span className="flex-1">{sub.name}</span>
                        {sub.ai ? <Badge tone="purple">AI</Badge> : null}
                        {sub.demo ? <Badge>demo</Badge> : null}
                        {sub.badge ? <Badge tone={sub.badge.type}>{sub.badge.n}</Badge> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div><div className="border-t border-line p-2"><button className="flex w-full items-center gap-2.5 rounded-[10px] border border-[#AFA9EC] bg-gradient-to-br from-[#EEEDFE] to-[#f6f5ff] px-3 py-2.5 text-[13px] font-medium text-[#534AB7] hover:bg-[#EEEDFE]" onClick={() => {
          // 修复说明：[P2-台账外]，原因：AI 助手按钮原无任何处理器；点击导航到 AI 工作台（aihub 首个子项）。
          const aihub = navigation?.modules.find((item) => item.id === 'aihub')
          const sub = aihub?.subs[0]
          if (aihub && sub) setActive({ moduleId: aihub.id, moduleName: aihub.name, subName: sub.name })
          setMobileNavOpen(false)
        }}><Sparkles className="h-4 w-4" /><span>AI 助手</span><span className="ml-auto text-[10px] font-normal text-[#7F77DD]">人工确认</span></button></div></aside>
        <section className="nexfab-scroll min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
          {loading ? <div className="text-sm text-muted">正在加载会话与导航...</div> : null}
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          <div className="mb-5">
            <div className="mb-2 text-xs text-slate-400">{active?.moduleName || '工作台'} / {active?.subName || '角色工作台'}</div>
            <div className="flex items-center gap-3">
              <h1 className="m-0 text-xl font-semibold text-[#111827]">{active?.subName || '角色工作台'}</h1>
              {active?.subName?.includes('AI') || active?.moduleName === 'AI Agent' ? <Sparkles className="h-5 w-5 text-purple-600" /> : <LayoutDashboard className="h-5 w-5 text-brand" />}
            </div>
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-6 text-muted">
              正式前端已接入后端会话、角色动态导航和工作台摘要。当前角色可见 <b className="text-brand">{visibleCount}</b> 个二级菜单；具体业务规则仍由现有后端 API 执行。
            </p>
          </div>
          {active && isAgentLibraryRoute(active) ? (
            <AgentLibraryView active={active} onNavigate={(target) => { setActive(target); setMobileNavOpen(false) }} />
          ) : active && isP21Route(active) ? (
            <P2AiWorkbenchView active={active} />
          ) : active && isP32Route(active) ? (
            <P3SocialAcquisitionView />
          ) : active && isP33Route(active) ? (
            <P3OutboundDraftView />
          ) : active && isP34Route(active) ? (
            <P3OperationsReportView />
          ) : active && isP3ToolsRoute(active) ? (
            <P3ToolsCenterView active={active} />
          // 修复说明：[中危-导航可达性]，原因：账号与权限分支位于覆盖全部 system 子菜单的 isP31Route 之后，条件恒为不可达；前置专用分支以恢复真实入口。
          ) : active && isAccountRoute(active) ? (
            <AccountAccessView user={user} />
          ) : active && isP31Route(active) ? (
            <P3OpsStatusView />
          ) : active && isP14Route(active) ? (
            <P1ImportDashboardView active={active} />
          ) : active?.moduleId === 'dashboard' ? (
            <>
            <div className="mb-3 flex h-[42px] items-center overflow-hidden rounded-[10px] border border-line bg-white text-xs text-muted">
              <div className="relative flex h-full min-w-[180px] flex-1 items-center overflow-hidden"><span className="marquee whitespace-nowrap">今日建议：先处理高意向询盘、低毛利报价需人工审批，外部动作必须留痕。</span></div>
              <div className="flex h-full items-center gap-1 border-l border-slate-100 px-3">当前角色 <b className="text-slate-700">{navigation?.roleName}</b></div>
              <div className="flex h-full items-center gap-1 border-l border-slate-100 bg-red-50 px-3 text-red-700">待办 <b>{dashboard?.metrics.find((item) => item.id === 'openTodos')?.value ?? 0}</b></div>
            </div>
            <DashboardView dashboard={dashboard} />
            </>
          ) : active && isTimelineRoute(active) ? (
            <TimelineView active={active} />
          ) : active && isCommissionRoute(active) ? (
            <CommissionView active={active} />
          ) : active && ((active.moduleId === 'customer' && active.subName === '客户画像') || (active.moduleId === 'pipeline' && active.subName === '售后与复购')) ? (
            <CustomerLifecycleView active={active} />
          ) : active && notAvailableInfo(active) ? (
            <NotAvailableView title={notAvailableInfo(active)!.title} reason={notAvailableInfo(active)!.reason} needed={notAvailableInfo(active)!.needed} />
          ) : active && isP11Route(active) ? (
            <P1AcquisitionCrmView active={active} />
          ) : active && isP12Route(active) ? (
            <P1ProductQuoteView active={active} />
          ) : active && isP13Route(active) ? (
            <P1FulfillmentFlowView active={active} />
          ) : (
            <div className="max-w-[760px] rounded-xl border border-blue-200 bg-blue-50 p-4 text-[13px] leading-7 text-blue-900">
              <b>页面接入策略：</b>该入口已按后端动态导航展示。P0 只完成正式前端骨架、角色导航、会话与工作台联调；后续业务页面继续消费现有 API，不复制业务规则到前端。
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
