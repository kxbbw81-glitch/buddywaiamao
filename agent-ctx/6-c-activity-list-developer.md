# Task 6-c: Activity List Developer

## Summary
Created full activity records list page and wired notification dropdown "查看全部" button.

## Files Created
- `src/components/crm/views/activity-list-view.tsx` - Full activity list view with filters, table, pagination, skeleton loading, empty state

## Files Modified
- `src/app/api/activities/route.ts` - Added search, type, dateRange, page, pageSize query params; returns paginated response
- `src/components/crm/notification-dropdown.tsx` - "查看全部" button now navigates to activities module via useCRMStore
- `src/lib/types.ts` - Added 'activities' to ModuleKey union and MODULE_LABELS
- `src/app/page.tsx` - Added import + case for ActivityListView in ModuleView switch

## Lint
- `bun run lint` passes with 0 errors
