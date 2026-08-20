'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Shield, Crown, Users, UserCheck, Wallet,
  ArrowRight, Zap,
} from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import type { User } from '@prisma/client'
import type { ModuleKey } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

// Components
import { useCRMKeyboard } from '@/hooks/use-crm-keyboard'
import { CRMSidebar } from '@/components/crm/crm-sidebar'
import { CRMHeader } from '@/components/crm/crm-header'
import { WorkbenchView } from '@/components/crm/views/workbench-view'
import { CustomerListView } from '@/components/crm/views/customer-list-view'
import { CustomerDetailDrawer } from '@/components/crm/views/customer-detail-drawer'
import { CustomerFormDialog } from '@/components/crm/views/customer-form-dialog'
import { InquiryListView } from '@/components/crm/views/inquiry-list-view'
import { InquiryDetailDrawer } from '@/components/crm/views/inquiry-detail-drawer'
import { InquiryFormDialog } from '@/components/crm/views/inquiry-form-dialog'
import { ProductListView } from '@/components/crm/views/product-list-view'
import { ProductFormDialog } from '@/components/crm/views/product-form-dialog'
import { QuotationListView } from '@/components/crm/views/quotation-list-view'
import { QuotationDetailDrawer } from '@/components/crm/views/quotation-detail-drawer'
import { QuotationFormDialog } from '@/components/crm/views/quotation-form-dialog'
import { OrderListView } from '@/components/crm/views/order-list-view'
import { OrderDetailDrawer } from '@/components/crm/views/order-detail-drawer'
import { SampleDetailDrawer } from '@/components/crm/views/sample-detail-drawer'
import { OrderFormDialog } from '@/components/crm/views/order-form-dialog'
import { SampleListView } from '@/components/crm/views/sample-list-view'
import { PaymentListView } from '@/components/crm/views/payment-list-view'
import { PaymentFormDialog } from '@/components/crm/views/payment-form-dialog'
import { AnalyticsView } from '@/components/crm/views/analytics-view'
import { DataScreenView } from '@/components/crm/views/data-screen-view'
import { SocialMediaView } from '@/components/crm/views/social-media-view'
import { AIAssistantDrawer } from '@/components/crm/views/ai-assistant-drawer'
import { SettingsView } from '@/components/crm/views/settings-view'
import { UserManagementView } from '@/components/crm/views/user-management-view'
import { ActivityListView } from '@/components/crm/views/activity-list-view'
import { CustomerMapView } from '@/components/crm/views/customer-map-view'

// UI Components
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})


function installApiBasePathPatch() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & {
    __nexfabApiFetchPatched?: boolean
    __nexfabOriginalFetch?: typeof window.fetch
  }
  if (w.__nexfabApiFetchPatched) return

  const originalFetch = window.fetch.bind(window)
  w.__nexfabOriginalFetch = originalFetch
  w.__nexfabApiFetchPatched = true

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const basePath = window.location.pathname === '/new' || window.location.pathname.startsWith('/new/') ? '/new' : ''
    if (basePath) {
      if (typeof input === 'string') {
        if (input === '/api' || input.startsWith('/api/')) {
          input = `${basePath}${input}`
        }
      } else if (input instanceof URL) {
        if (input.origin === window.location.origin && (input.pathname === '/api' || input.pathname.startsWith('/api/'))) {
          input = new URL(`${basePath}${input.pathname}${input.search}${input.hash}`, window.location.origin)
        }
      } else if (input instanceof Request) {
        const url = new URL(input.url)
        if (url.origin === window.location.origin && (url.pathname === '/api' || url.pathname.startsWith('/api/'))) {
          input = new Request(new URL(`${basePath}${url.pathname}${url.search}${url.hash}`, window.location.origin), input)
        }
      }
    }
    return originalFetch(input, init)
  }) as typeof window.fetch
}

const roleCards = [
  { role: 'super_admin', email: 'admin@nexfab.com', label: '超级管理员', desc: '拥有系统全部权限，可查看所有数据和系统配置', icon: Shield, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', borderColor: 'role-card-border-emerald' },
  { role: 'management', email: 'wang@nexfab.com', label: '管理层', desc: '查看整体业务数据、营收分析、团队绩效和风险预警', icon: Crown, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', borderColor: 'role-card-border-amber' },
  { role: 'sales_manager', email: 'li@nexfab.com', label: '销售经理', desc: '管理销售团队、分配询盘、审批报价、追踪团队目标', icon: Users, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', borderColor: 'role-card-border-teal' },
  { role: 'sales', email: 'chen@nexfab.com', label: '销售专员', desc: '跟进询盘、管理客户、创建报价、处理订单和样品', icon: UserCheck, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300', borderColor: 'role-card-border-sky' },
  { role: 'finance', email: 'zhao@nexfab.com', label: '财务人员', desc: '管理收款、跟踪付款、查看利润率和财务报表', icon: Wallet, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300', borderColor: 'role-card-border-rose' },
]

function RoleSelectionScreen({ onSelect }: { onSelect: (user: User) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950 dark:via-background dark:to-teal-950 flex items-center justify-center p-4 workbench-bg">
      <motion.div
        className="max-w-4xl w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            className="inline-flex items-center gap-3 mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25">
              <Zap className="h-8 w-8" />
            </div>
          </motion.div>
          <motion.h1
            className="text-3xl font-bold mb-2 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            NexFab AI CRM
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-lg mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            外贸智能客户管理系统
          </motion.p>
          <motion.p
            className="text-sm text-emerald-600/70 dark:text-emerald-400/70 mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            AI驱动 · 高效跟进 · 全球客户一站管理
          </motion.p>
          <motion.p
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            选择一个角色身份进入系统演示
          </motion.p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleCards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.role}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
              >
                <Card
                  className={cn(
                    'cursor-pointer role-card-gradient-border crm-card-hover transition-all',
                    card.borderColor,
                  )}
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: card.email }),
                      })
                      const data = await res.json()
                      if (data.success && data.data) {
                        onSelect(data.data)
                      }
                    } catch {
                      // fallback: create a mock user
                      const mockUser: User = {
                        id: `mock-${card.role}`,
                        email: card.email,
                        name: card.label,
                        primaryRole: card.role,
                        department: card.role === 'finance' ? '财务部' : card.role === 'sales_manager' ? '销售部' : '总经办',
                        tenantId: 1,
                        passwordHash: null,
                        avatar: null,
                        additionalRoles: '[]',
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      }
                      onSelect(mockUser)
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn('p-2.5 rounded-lg shrink-0', card.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1">{card.label}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {ROLE_LABELS[card.role as keyof typeof ROLE_LABELS] || card.role}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <motion.p
          className="text-center text-xs text-muted-foreground mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          NexFab AI CRM — Powered by AI · 智能外贸客户关系管理
        </motion.p>
      </motion.div>
    </div>
  )
}

function ModuleView() {
  const { currentModule } = useCRMStore()

  const renderView = () => {
    switch (currentModule) {
      case 'workbench': return <WorkbenchView />
      case 'customers': return <CustomerListView />
      case 'inquiries': return <InquiryListView />
      case 'products': return <ProductListView />
      case 'quotations': return <QuotationListView />
      case 'orders': return <OrderListView />
      case 'samples': return <SampleListView />
      case 'payments': return <PaymentListView />
      case 'analytics': return <AnalyticsView />
      case 'data_screen': return <DataScreenView />
      case 'social_media': return <SocialMediaView />
      case 'settings': return <SettingsView />
      case 'activities': return <ActivityListView />
      case 'user_management': return <UserManagementView />
      case 'customer_map': return <CustomerMapView />
      default: return <WorkbenchView />
    }
  }

  // Data screen renders as a full-screen overlay
  if (currentModule === 'data_screen') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentModule}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentModule}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.2 }}
        className="p-4 lg:p-6"
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  )
}

function CRMApp() {
  const { currentUser, setCurrentUser } = useCRMStore()

  // Global keyboard shortcuts (only when user is logged in)
  useCRMKeyboard()

  useEffect(() => {
    
    // Check localStorage for saved user
    const saved = localStorage.getItem('nexfab_user')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        setCurrentUser(user)
      } catch {
        localStorage.removeItem('nexfab_user')
      }
    }
  }, [setCurrentUser])

  const handleSelectRole = useCallback((user: User) => {
    setCurrentUser(user)
    localStorage.setItem('nexfab_user', JSON.stringify(user))
  }, [setCurrentUser])

  // Show role selection if no user
  if (!currentUser) {
    return <RoleSelectionScreen onSelect={handleSelectRole} />
  }

  return (
    <SidebarProvider>
      <CRMSidebar />
      <SidebarInset>
        <CRMHeader />
        <main className="flex-1 overflow-auto">
          <ModuleView />
        </main>
      </SidebarInset>

      {/* Detail Drawers */}
      <CustomerDetailDrawer />
      <InquiryDetailDrawer />
      <QuotationDetailDrawer />
      <OrderDetailDrawer />
      <SampleDetailDrawer />

      {/* Form Dialogs */}
      <CustomerFormDialog />
      <InquiryFormDialog />
      <QuotationFormDialog />
      <ProductFormDialog />
      <OrderFormDialog />
      <PaymentFormDialog />

      {/* AI Assistant */}
      <AIAssistantDrawer />
    </SidebarProvider>
  )
}

export default function CRMPage() {
  installApiBasePathPatch()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <CRMApp />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
