'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Grid3X3, List, Package, Search } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, cn } from '@/lib/utils'

// Product status uses isActive boolean — map to display label & badge class
const PRODUCT_STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: '在售', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  inactive: { label: '停售', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400' },
}

type Product = {
  id: string
  productCode: string
  name: string
  nameEn?: string | null
  category?: string | null
  specification?: string | null
  unit: string
  costPrice: number
  minPrice: number
  standardPrice: number
  description?: string | null
  imageUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function ProductListView() {
  const { searchQuery, filters, setFilters, openProductForm } = useCRMStore()

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')

  // Main filtered query for product list
  const { data, isLoading } = useQuery({
    queryKey: ['products', searchQuery, filters.productCategory],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.productCategory) params.set('category', filters.productCategory)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
  })

  // Separate unfiltered query just for extracting all available categories
  const { data: allProductsData } = useQuery({
    queryKey: ['products-all-categories'],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('pageSize', '200')
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
    staleTime: 60_000,
  })

  const products: Product[] = data?.data || []
  const allProducts: Product[] = allProductsData?.data || []

  // Extract unique categories from ALL products (not filtered subset)
  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))]

  const tableColumns = [
    {
      key: 'productCode',
      header: '产品编号',
      sortable: true,
      render: (item: Product) => (
        <span className="font-mono text-xs text-muted-foreground">{item.productCode}</span>
      ),
    },
    {
      key: 'name',
      header: '产品名称',
      render: (item: Product) => (
        <div>
          <p className="text-sm font-medium leading-tight">{item.name}</p>
          {item.nameEn && item.nameEn !== item.name && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.nameEn}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: '分类',
      render: (item: Product) => (
        <Badge variant="outline" className="text-xs shrink-0">
          {item.category || '未分类'}
        </Badge>
      ),
    },
    {
      key: 'standardPrice',
      header: '标准价',
      sortable: true,
      render: (item: Product) => (
        <span className="text-sm font-medium crm-number">{formatCurrency(item.standardPrice)}</span>
      ),
    },
    {
      key: 'costPrice',
      header: '成本价',
      sortable: true,
      render: (item: Product) => (
        <span className="text-xs crm-number">{formatCurrency(item.costPrice)}</span>
      ),
    },
    {
      key: 'unit',
      header: '库存单位',
      render: (item: Product) => (
        <span className="text-xs text-muted-foreground">{item.unit}</span>
      ),
    },
    {
      key: 'isActive',
      header: '状态',
      sortable: true,
      render: (item: Product) => {
        const statusKey = item.isActive ? 'active' : 'inactive'
        const statusInfo = PRODUCT_STATUS_MAP[statusKey]
        return (
          <Badge
            variant="secondary"
            className={cn('font-medium border-0 text-xs shrink-0', statusInfo?.className)}
          >
            {statusInfo?.label}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="搜索产品名称、编号..."
            className="h-9 pl-8"
            value={searchQuery}
            onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category filter – populated from ALL products */}
        <Select
          value={filters.productCategory || 'all'}
          onValueChange={(v) => setFilters({ productCategory: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle (list / grid) */}
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

      {/* Table view */}
      {viewMode === 'table' ? (
        <DataTable
          columns={tableColumns}
          data={products as unknown as Record<string, unknown>[]}
          isLoading={isLoading && products.length === 0}
          emptyMessage="暂无产品数据"
          searchValue=""
          onSearchChange={() => {}}
        />
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const cost = product.costPrice
            const standard = product.standardPrice
            const margin = standard > 0 ? ((standard - cost) / standard) * 100 : 0

            return (
              <Card key={product.id} className="crm-card-lift overflow-hidden">
                {/* Image placeholder with Package icon */}
                <div className="h-36 bg-muted flex items-center justify-center relative">
                  <Package className="h-14 w-14 text-muted-foreground/15" />
                  {/* Category badge */}
                  <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                    {product.category || '未分类'}
                  </Badge>
                  {/* Status indicator */}
                  {!product.isActive && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 left-2 text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400 border-0"
                    >
                      停售
                    </Badge>
                  )}
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Name + nameEn + code */}
                  <div>
                    <h3 className="font-bold text-sm leading-tight">{product.name}</h3>
                    {product.nameEn && product.nameEn !== product.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{product.nameEn}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{product.productCode}</p>
                  </div>

                  {/* Pricing + margin */}
                  <div className="flex items-end justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">成本价</p>
                      <p className="text-xs crm-number">{formatCurrency(cost)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">标准价</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 crm-number">
                        {formatCurrency(standard)}
                      </p>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[11px] text-muted-foreground">利润率</p>
                      <p
                        className={cn(
                          'text-sm font-bold crm-number',
                          margin >= 20
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : margin >= 10
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {margin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {!isLoading && products.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">暂无产品数据</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
