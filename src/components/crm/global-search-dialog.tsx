'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, FileText, Calculator, ShoppingCart, Search, Loader2 } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useCRMStore } from '@/store/use-crm-store'
import type { ModuleKey } from '@/lib/types'

interface SearchResult {
  id: string
  type: 'customer' | 'inquiry' | 'quotation' | 'order'
  text: string
  subtitle: string
}

interface SearchResponse {
  success: boolean
  data: {
    customers: SearchResult[]
    inquiries: SearchResult[]
    quotations: SearchResult[]
    orders: SearchResult[]
  }
  error?: string
}

const MODULE_MAP: Record<string, ModuleKey> = {
  customer: 'customers',
  inquiry: 'inquiries',
  quotation: 'quotations',
  order: 'orders',
}

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    setCurrentModule,
    selectCustomer,
    selectInquiry,
    selectQuotation,
    selectOrder,
  } = useCRMStore()

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
    }
  }, [open])

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value.trim()) {
      setResults(null)
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`)
        const data: SearchResponse = await res.json()
        if (data.success) {
          setResults(data.data)
        }
      } catch {
        // Silently ignore search errors
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  // Handle result click
  const handleSelect = useCallback(
    (item: SearchResult) => {
      const targetModule = MODULE_MAP[item.type]
      if (targetModule) {
        setCurrentModule(targetModule)
      }
      switch (item.type) {
        case 'customer':
          selectCustomer(item.id)
          break
        case 'inquiry':
          selectInquiry(item.id)
          break
        case 'quotation':
          selectQuotation(item.id)
          break
        case 'order':
          selectOrder(item.id)
          break
      }
      setOpen(false)
    },
    [setCurrentModule, selectCustomer, selectInquiry, selectQuotation, selectOrder]
  )

  const hasResults =
    results &&
    (results.customers.length > 0 ||
      results.inquiries.length > 0 ||
      results.quotations.length > 0 ||
      results.orders.length > 0)

  return (
    <>
      {/* Trigger button in header */}
      <button
        onClick={() => setOpen(true)}
        className="relative hidden md:flex items-center gap-2 h-9 w-64 rounded-md border border-input bg-background/50 px-3 text-sm text-muted-foreground cursor-pointer hover:bg-accent/50 transition-colors"
        aria-label="全局搜索"
      >
        <Search className="h-4 w-4 shrink-0 opacity-50" />
        <span className="truncate">搜索客户、询盘...</span>
        <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70">
          <abbr title="Command" className="no-underline">⌘</abbr>K
        </kbd>
      </button>

      {/* Mobile search button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent/50 transition-colors"
        aria-label="全局搜索"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="输入关键词搜索客户、询盘..."
          value={query}
          onValueChange={handleSearch}
        />
        <CommandList className="max-h-[400px]">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <span className="ml-2 text-sm text-muted-foreground">搜索中...</span>
            </div>
          )}
          {!loading && !hasResults && query.trim() && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <span>没有找到结果</span>
                <span className="text-xs text-muted-foreground">请尝试其他关键词</span>
              </div>
            </CommandEmpty>
          )}
          {!loading && !hasResults && !query.trim() && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <span>输入关键词搜索客户、询盘...</span>
              </div>
            </CommandEmpty>
          )}
          {results?.customers && results.customers.length > 0 && (
            <CommandGroup heading="客户">
              {results.customers.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`customer-${item.id}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{item.text}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.inquiries && results.inquiries.length > 0 && (
            <CommandGroup heading="询盘">
              {results.inquiries.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`inquiry-${item.id}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{item.text}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.quotations && results.quotations.length > 0 && (
            <CommandGroup heading="报价">
              {results.quotations.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`quotation-${item.id}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                    <Calculator className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{item.text}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.orders && results.orders.length > 0 && (
            <CommandGroup heading="订单">
              {results.orders.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`order-${item.id}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{item.text}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
