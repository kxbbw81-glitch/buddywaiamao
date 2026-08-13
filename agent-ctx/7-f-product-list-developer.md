# Task 7-f: Product List Developer — Work Record

## Summary
Enhanced the product list view (`src/components/crm/views/product-list-view.tsx`) with functional category filtering, search, view toggle, and complete table/grid view content.

## Changes Made

### 1. Category Filter Fix (Critical)
**Problem**: Categories were extracted from the already-filtered product list. When a category was selected, only that category's products returned, so the dropdown collapsed to one option — users couldn't switch categories.
**Fix**: Added a separate `useQuery` (`products-all-categories`) with no filters, fetching all products with `staleTime: 60_000`. Categories are extracted from this unfiltered dataset.

### 2. Search (Already Working)
The search input existed and works via API (`/api/products?search=...`) which searches `productCode`, `name`, and `nameEn`. Added a `Search` icon for better visual affordance.

### 3. ToggleGroup View Switch (Already Working)
List/Grid toggle buttons existed and function correctly using local `viewMode` state.

### 4. Grid View Cards Enhanced
- Added `nameEn` display below the Chinese name
- Package icon placeholder for product image
- Category badge (top-right)
- "停售" badge (top-left) for inactive products
- Cost price, standard price, profit margin with color coding
- Empty state with Package icon

### 5. Table View Columns Updated
Reordered and updated columns to: code, name (+nameEn), category, standard price, cost price, stock unit, status.
- Status uses `isActive` boolean → "在售" (green) / "停售" (gray) badges
- Standard price shown bold, before cost price

## Files Modified
- `src/components/crm/views/product-list-view.tsx`

## Verification
- ESLint: passed (no errors)
- TypeScript: explicit Product type defined
- All text in Chinese
- Uses `formatCurrency` from `@/lib/utils`
- Responsive grid: 1/2/3/4 columns
