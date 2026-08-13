'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  pageSize?: number
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

// Approximate skeleton widths based on column key
const skeletonWidths: Record<string, string> = {
  inquiryNo: 'max-w-[80px]',
  subject: 'max-w-[180px]',
  customer: 'max-w-[140px]',
  country: 'max-w-[100px]',
  companyName: 'max-w-[160px]',
  status: 'max-w-[70px]',
  priority: 'max-w-[60px]',
  source: 'max-w-[70px]',
  owner: 'max-w-[70px]',
  assignee: 'max-w-[70px]',
  createdAt: 'max-w-[90px]',
  lastContactAt: 'max-w-[90px]',
  _count: 'max-w-[50px]',
  customerLevel: 'max-w-[80px]',
  amount: 'max-w-[90px]',
  totalAmount: 'max-w-[90px]',
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  searchPlaceholder = '搜索...',
  searchValue = '',
  onSearchChange,
  isLoading = false,
  emptyMessage = '暂无数据',
  emptyIcon,
  pageSize: initialPageSize = 10,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const search = searchValue !== undefined ? searchValue : internalSearch
  const handleSearch = onSearchChange || setInternalSearch

  const filteredData = useMemo(() => {
    if (!search) return data
    return data.filter((item) =>
      Object.values(item).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(search.toLowerCase())
      )
    )
  }, [data, search])

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal === bVal) return 0
      const cmp = aVal < bVal ? -1 : 1
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredData, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              handleSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>共 <span className="font-medium crm-number">{filteredData.length}</span> 条</span>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'text-xs font-medium text-muted-foreground transition-colors',
                    col.sortable && 'cursor-pointer select-none hover:bg-muted/60 hover:text-foreground',
                    col.width
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key ? (
                        sortDir === 'asc' 
                          ? <ArrowUp className="h-3 w-3 text-emerald-600" /> 
                          : <ArrowDown className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className={cn('h-4 w-full', skeletonWidths[col.key] || 'max-w-[100px]')} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="p-3 rounded-full bg-muted/50 mb-3">
                      {emptyIcon || <FileSpreadsheet className="h-8 w-8 opacity-40" />}
                    </div>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    <p className="text-xs text-muted-foreground mt-1">试试调整筛选条件或新建一条记录</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, i) => (
                <TableRow
                  key={(item as Record<string, unknown>).id as string || i}
                  className={cn(
                    'crm-table-row',
                    i % 2 === 1 && 'crm-table-row-odd',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className="text-sm">
                      <div className="truncate-cell">{col.render(item)}</div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredData.length > pageSize && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-sm px-3 crm-number">
              {safePage} / {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
