'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Grid3X3, List, Package } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, cn } from '@/lib/utils'

export function ProductListView() {
  const { searchQuery, filters, setFilters, openProductForm } = useCRMStore()

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
    { key: 'name', header: '产品名称', render: (item: Record<string, unknown>) => <div><p className="text-sm font-medium">{item.name as string}</p>{item.nameEn && item.nameEn !== item.name ? <p className="text-xs text-muted-foreground">{item.nameEn as string}</p> : null}</div> },
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
          <Button
            size="sm"
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            className="h-8 px-2.5"
            onClick={() => setViewMode('table')}
            aria-label="列表视图"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            className="h-8 px-2.5"
            onClick={() => setViewMode('grid')}
            aria-label="网格视图"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" onClick={() => openProductForm()} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> 新建产品
        </Button>
      </div>

      {viewMode === 'table' ? (
        <DataTable columns={tableColumns} data={products} isLoading={isLoading && products.length === 0} emptyMessage="暂无产品数据" searchValue="" onSearchChange={() => {}} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product: Record<string, unknown>) => {
            const cost = product.costPrice as number
            const standard = product.standardPrice as number
            const margin = standard > 0 ? ((standard - cost) / standard * 100) : 0
            return (
              <Card key={product.id as string} className="crm-card-lift overflow-hidden">
                <div className="h-36 bg-muted flex items-center justify-center relative">
                  <Package className="h-14 w-14 text-muted-foreground/15" />
                  <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                    {product.category as string || '未分类'}
                  </Badge>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-sm leading-tight">{product.name as string}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{product.productCode as string}</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">成本价</p>
                      <p className="text-xs crm-number">{formatCurrency(cost)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">标准价</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 crm-number">{formatCurrency(standard)}</p>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[11px] text-muted-foreground">利润率</p>
                      <p className={cn(
                        'text-sm font-bold crm-number',
                        margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : margin >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {margin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {!isLoading && products.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">暂无产品数据</div>
          )}
        </div>
      )}
    </div>
  )
}
