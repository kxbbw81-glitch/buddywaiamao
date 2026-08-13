'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Grid3X3, List } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)
}

export function ProductListView() {
  const { searchQuery, filters, setFilters, openProductForm } = useCRMStore()
  const queryClient = useQueryClient()
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')

  

  const { data, isLoading } = useQuery({
    queryKey: ['products', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.productCategory) params.set('category', filters.productCategory)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
  })

  const products = data?.data || []

  const categories = [...new Set(products.map((p: Record<string, unknown>) => p.category as string).filter(Boolean))]

  const tableColumns = [
    { key: 'productCode', header: '产品编号', sortable: true, render: (item: Record<string, unknown>) => <span className="font-mono text-xs">{item.productCode as string}</span> },
    { key: 'name', header: '产品名称', render: (item: Record<string, unknown>) => <div><p className="text-sm font-medium">{item.name as string}</p>{item.nameEn && <p className="text-xs text-muted-foreground">{item.nameEn as string}</p>}</div> },
    { key: 'category', header: '分类', render: (item: Record<string, unknown>) => <Badge variant="outline" className="text-xs">{item.category as string || '-'}</Badge> },
    { key: 'costPrice', header: '成本价', render: (item: Record<string, unknown>) => <span className="text-xs crm-number">{formatCurrency(item.costPrice as number)}</span> },
    { key: 'standardPrice', header: '标准价', render: (item: Record<string, unknown>) => <span className="text-sm font-medium crm-number">{formatCurrency(item.standardPrice as number)}</span> },
    { key: 'minPrice', header: '最低价', render: (item: Record<string, unknown>) => <span className="text-xs crm-number">{formatCurrency(item.minPrice as number)}</span> },
    { key: 'unit', header: '单位', render: (item: Record<string, unknown>) => <span className="text-xs">{item.unit as string}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input placeholder="搜索产品名称、编号..." className="h-9" value={searchQuery} onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)} />
        </div>
        <Select value={filters.productCategory || 'all'} onValueChange={(v) => setFilters({ productCategory: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="分类" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md">
          <Button size="sm" variant={viewMode === 'table' ? 'secondary' : 'ghost'} className="h-8 px-2.5" onClick={() => setViewMode('table')}><List className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} className="h-8 px-2.5" onClick={() => setViewMode('grid')}><Grid3X3 className="h-3.5 w-3.5" /></Button>
        </div>
        <Button size="sm" onClick={() => openProductForm()} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> 新建产品
        </Button>
      </div>

      {viewMode === 'table' ? (
        <DataTable columns={tableColumns} data={products} isLoading={isLoading && products.length === 0} emptyMessage="暂无产品数据" searchValue="" onSearchChange={() => {}} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product: Record<string, unknown>) => (
            <Card key={product.id as string} className="crm-card-hover overflow-hidden">
              <div className="h-32 bg-muted flex items-center justify-center">
                <span className="text-4xl opacity-20">📦</span>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-1">{product.name as string}</h3>
                <p className="text-xs text-muted-foreground mb-3">{product.productCode as string} · {product.category as string}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-emerald-600 crm-number">{formatCurrency(product.standardPrice as number)}</span>
                  <Badge variant="outline" className="text-[10px]">{product.unit as string}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && products.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">暂无产品数据</div>
          )}
        </div>
      )}
    </div>
  )
}
