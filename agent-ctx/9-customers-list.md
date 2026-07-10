# Task 9: CCTVCustomersList — Real API Integration

## Agent: Main Agent
## Segment: 3C — Customer Loyalty & CRM

## Work Done

Rewrote `/home/z/my-project/src/modules/cctv-shop/components/CCTVCustomersList.tsx` to replace mock data with real API integration.

### Changes
1. **Removed mock data** — deleted the `mockCustomers` array (8 hardcoded entries)
2. **Added API fetching** — `GET /api/businesses/bus_placeholder/cctv/customers?search=...&tier=...&sortBy=cctvTotalSpent&sortDir=desc`
3. **Debounced search** — 300ms debounce via `useEffect` + `setTimeout`, with `AbortController` for cleanup
4. **Server-side filtering** — tier filter passes `tier` query param to API (no client-side filter needed)
5. **Loading state** — 5 skeleton cards matching card layout (avatar + name/badge row + stats row)
6. **Empty state** — contextual message depending on whether filters are active
7. **Quick stats row** — total customers, with balance (placeholder, EMI data not in API response), loyalty members (tier !== BRONZE) via `useMemo`
8. **Tier filter tabs** — All / Bronze / Silver / Gold / Platinum with gradient active state
9. **Customer cards** — tier-colored avatar (first letter), name (truncated), phone, tier Badge, stats row (Purchases count, Total Spent in BDT, Points)
10. **Tier colors** — Avatar: BRONZE=amber, SILVER=gray, GOLD=yellow, PLATINUM=violet. Badge: matching lighter variants.
11. **Navigation** — card tap calls `navigate('customer-detail', customer.id)`
12. **Animations** — `fadeUp` wrapper, `AnimatePresence mode="popLayout"`, staggered card entrance

### Lint Fix
- Initial version had `setLoading(true)` called directly in effect body (violates `react-hooks/set-state-in-effect`)
- Fixed by wrapping fetch logic in `const fetchCustomers = async () => { ... }` called within effect (matches existing project pattern from `CCTVJobCardsList`)

### Conventions Followed
- `'use client'` at top
- Named export: `export function CCTVCustomersList()`
- `useCCTVNavStore` from `@/stores/cctv-nav-store`
- `BUSINESS_ID = 'bus_placeholder'`
- Cards: `bg-white rounded-2xl border border-gray-100 p-4 shadow-sm`
- CTAs use violet gradient
- `motion` from `framer-motion`, `fadeUp` animation pattern
- Icons from `lucide-react`
- `cn` from `@/lib/utils`
- `formatBDT(n)` — `৳{n.toLocaleString()}`
- `Skeleton` from `@/components/ui/skeleton`
- `Badge` from `@/components/ui/badge`

### API Response Shape Handled
```json
{
  "id": "...",
  "name": "Rahim Electronics",
  "phone": "01712-345678",
  "totalSpent": 245000,
  "visitCount": 12,
  "loyaltyPoints": 2450,
  "loyaltyTier": "SILVER",
  "preferredPaymentMethod": "BKASH",
  "createdAt": "2025-01-10T...",
  "cctvSalesCount": 8,
  "cctvTotalSpent": 245000
}
```

## Status: Complete
## Lint: Passing (0 errors, 0 warnings)