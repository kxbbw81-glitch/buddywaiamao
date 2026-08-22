# Task 8: 数据看板大屏 (Data Screen Dashboard)

## Summary
Implemented a full-screen, dark-themed data visualization dashboard (数据大屏) for NexFab AI CRM v4.1, designed for management-level users to monitor real-time business metrics on large displays.

## Files Created/Modified

### New Files
1. **`src/app/api/data-screen/route.ts`** - Backend API endpoint that aggregates 14 categories of business data:
   - Core KPIs (revenue, customers, orders, conversion rate, collection rate)
   - Monthly revenue trend (12 months with order counts)
   - Sales funnel (5-stage: 全部询盘→跟进中→已报价→已成交→已流失)
   - Country/region revenue distribution (TOP10)
   - Sales team performance ranking
   - Inquiry source distribution
   - Order status distribution
   - Customer level distribution (A/B/C/D)
   - Top 10 customers by revenue
   - Risk alerts (overdue payments, low margin quotes, unassigned inquiries)
   - Recent activity feed (15 items)
   - Payment status summary
   - This-month stats comparison
   - Inquiry trend (6 months)

2. **`src/components/crm/views/data-screen-view.tsx`** - Full-screen data visualization component featuring:
   - **Dark futuristic theme** with deep navy background, cyan/emerald accents, glassmorphism panels
   - **7 KPI cards** at the top with glow effects, trend indicators, and sub-metrics
   - **12-month revenue area chart** (dual-axis: revenue + order count)
   - **Sales funnel** with animated horizontal bars
   - **Inquiry source pie chart** with percentage breakdown
   - **Customer level horizontal bar chart**
   - **Region revenue TOP10 horizontal bar chart**
   - **Order status donut chart** with legend
   - **Core metrics ring** (RadialBarChart for conversion rate + collection/won/lost stats)
   - **Sales team ranking** with animated progress bars
   - **Top 5 customer revenue list** with country flags
   - **Risk alerts panel** with color-coded severity (danger/warning/info)
   - **6-month inquiry trend bar chart**
   - **Real-time activity feed** (15 items)
   - **Live clock** with date display
   - **Auto-refresh** every 60 seconds
   - **ESC key** and **X button** to exit full-screen overlay
   - **Loading skeleton** for initial data fetch

### Modified Files
1. **`src/lib/types.ts`** - Added `data_screen` to `ModuleKey` union type and `MODULE_LABELS`
2. **`src/app/page.tsx`** - Added `DataScreenView` import, case in `ModuleView`, and full-screen overlay rendering path
3. **`src/components/crm/crm-sidebar.tsx`** - Added `Monitor` icon import and `data_screen` nav item (roles: super_admin, management)
4. **`src/app/globals.css`** - Added 70+ lines of data-screen-specific CSS styles (`.ds-container`, `.ds-panel`, `.ds-kpi-card`, `.ds-scroll`, etc.)

## Design Decisions
- **Full-screen overlay (fixed inset-0 z-50)**: The data screen covers the entire viewport including sidebar/header for an immersive big-screen experience
- **Dark theme forced**: Regardless of system theme, the data screen always uses its own dark color scheme for consistency on display screens
- **Cyan + Emerald accent palette**: Chosen for a high-tech command center feel, distinct from the main CRM emerald theme
- **Glassmorphism panels**: Semi-transparent panels with backdrop blur create depth and visual hierarchy
- **No shadcn/ui Card wrappers**: The data screen uses custom-styled divs for full control over the dark theme
- **Recharts directly**: Used Recharts components directly (not shadcn chart wrapper) for custom tooltip styling on dark backgrounds

## Access
- Available to: `super_admin` and `management` roles
- Navigation: Sidebar → 数据大屏 (Monitor icon)
- Exit: Click X button or press ESC key