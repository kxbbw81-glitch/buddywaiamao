import { create } from 'zustand'
import type { ModuleKey, CRMFilters } from '@/lib/types'
import type { User } from '@prisma/client'

interface CRMState {
  currentUser: User | null
  currentModule: ModuleKey
  currentSubView: string
  sidebarCollapsed: boolean
  aiDrawerOpen: boolean
  selectedCustomerId: string | null
  selectedInquiryId: string | null
  selectedQuotationId: string | null
  selectedOrderId: string | null
  selectedProductId: string | null
  selectedSampleId: string | null
  searchQuery: string
  filters: CRMFilters
  customerFormOpen: boolean
  customerEditId: string | null
  inquiryFormOpen: boolean
  inquiryEditId: string | null
  quotationFormOpen: boolean
  quotationEditId: string | null
  orderFormOpen: boolean
  orderEditId: string | null
  productFormOpen: boolean
  productEditId: string | null
  paymentFormOpen: boolean
}

interface CRMActions {
  setCurrentUser: (user: User | null) => void
  setCurrentModule: (module: ModuleKey) => void
  setCurrentSubView: (view: string) => void
  setCurrentNavigation: (module: ModuleKey, view: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setAiDrawerOpen: (open: boolean) => void
  toggleAiDrawer: () => void
  selectCustomer: (id: string | null) => void
  selectInquiry: (id: string | null) => void
  selectQuotation: (id: string | null) => void
  selectOrder: (id: string | null) => void
  selectProduct: (id: string | null) => void
  selectSample: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<CRMFilters>) => void
  clearFilters: () => void
  openCustomerForm: (editId?: string) => void
  closeCustomerForm: () => void
  openInquiryForm: (editId?: string) => void
  closeInquiryForm: () => void
  openQuotationForm: (editId?: string) => void
  closeQuotationForm: () => void
  openOrderForm: (editId?: string) => void
  closeOrderForm: () => void
  openProductForm: (editId?: string) => void
  closeProductForm: () => void
  openPaymentForm: () => void
  closePaymentForm: () => void
  logout: () => void
}

export const useCRMStore = create<CRMState & CRMActions>((set) => ({
  // State
  currentUser: null,
  currentModule: 'workbench',
  currentSubView: '',
  sidebarCollapsed: false,
  aiDrawerOpen: false,
  selectedCustomerId: null,
  selectedInquiryId: null,
  selectedQuotationId: null,
  selectedOrderId: null,
  selectedProductId: null,
  selectedSampleId: null,
  searchQuery: '',
  filters: {},
  customerFormOpen: false,
  customerEditId: null,
  inquiryFormOpen: false,
  inquiryEditId: null,
  quotationFormOpen: false,
  quotationEditId: null,
  orderFormOpen: false,
  orderEditId: null,
  productFormOpen: false,
  productEditId: null,
  paymentFormOpen: false,

  // Actions
  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentModule: (module) => set({ currentModule: module, currentSubView: '', searchQuery: '' }),
  setCurrentSubView: (view) => set({ currentSubView: view }),
  setCurrentNavigation: (module, view) => set({ currentModule: module, currentSubView: view, searchQuery: '' }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setAiDrawerOpen: (open) => set({ aiDrawerOpen: open }),
  toggleAiDrawer: () => set((s) => ({ aiDrawerOpen: !s.aiDrawerOpen })),
  selectCustomer: (id) => set({ selectedCustomerId: id }),
  selectInquiry: (id) => set({ selectedInquiryId: id }),
  selectQuotation: (id) => set({ selectedQuotationId: id }),
  selectOrder: (id) => set({ selectedOrderId: id }),
  selectProduct: (id) => set({ selectedProductId: id }),
  selectSample: (id) => set({ selectedSampleId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  clearFilters: () => set({ filters: {} }),
  openCustomerForm: (editId) => set({ customerFormOpen: true, customerEditId: editId || null }),
  closeCustomerForm: () => set({ customerFormOpen: false, customerEditId: null }),
  openInquiryForm: (editId) => set({ inquiryFormOpen: true, inquiryEditId: editId || null }),
  closeInquiryForm: () => set({ inquiryFormOpen: false, inquiryEditId: null }),
  openQuotationForm: (editId) => set({ quotationFormOpen: true, quotationEditId: editId || null }),
  closeQuotationForm: () => set({ quotationFormOpen: false, quotationEditId: null }),
  openOrderForm: (editId) => set({ orderFormOpen: true, orderEditId: editId || null }),
  closeOrderForm: () => set({ orderFormOpen: false, orderEditId: null }),
  openProductForm: (editId) => set({ productFormOpen: true, productEditId: editId || null }),
  closeProductForm: () => set({ productFormOpen: false, productEditId: null }),
  openPaymentForm: () => set({ paymentFormOpen: true }),
  closePaymentForm: () => set({ paymentFormOpen: false }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nexfab_user')
      // 同步清除服务端会话 Cookie（失败不阻塞本地登出）
      fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
    }
    set({
      currentUser: null,
      currentModule: 'workbench',
      selectedCustomerId: null,
      selectedInquiryId: null,
      selectedQuotationId: null,
      selectedOrderId: null,
      selectedProductId: null,
      selectedSampleId: null,
      filters: {},
      searchQuery: '',
    })
  },
}))
