# Task 10 — CCTVCustomerDetail.tsx

## Summary
Created `/home/z/my-project/src/modules/cctv-shop/components/CCTVCustomerDetail.tsx` — full customer profile screen for the CCTV Shop module (Segment 3C: Customer Loyalty & CRM).

## What was built
- **Named export**: `export function CCTVCustomerDetail()`
- **Header**: Back button + "Customer Profile" title (matches existing detail screens)
- **Profile Card**: Avatar circle with initials (colored by loyalty tier), name, phone (tap-to-call), email, address
- **Loyalty Points Card**: Violet gradient card with large points display, animated tier progress bar, Redeem Points and Adjust Points buttons
- **Stats Row**: 2x2 grid showing Total Spent, Visits, Active EMI, EMI Remaining
- **Tabs Section** (shadcn Tabs):
  - **Purchases**: List of recent sales with saleCode, amount, status badge, date — each navigates to `sale-detail`
  - **EMI Plans**: List of active EMI plans with product name, remaining, monthly, status — each navigates to `emi-detail`
  - **Points History**: Loyalty transactions with type icon/badge, +/- points, balance after, description, date
- **Redeem Dialog**: Shows current points, redeem rate, number input, live discount preview, AlertDialog confirmation, POST to redeem API
- **Adjust Points Dialog**: Add/Deduct toggle, points input, reason input, AlertDialog confirmation, POST to loyalty API
- **Loading state**: Skeleton placeholders for all sections
- **Empty states**: Per tab when no data

## Conventions followed
- `'use client'` at top
- `BUSINESS_ID = 'bus_placeholder'`
- `useCCTVNavStore` for `navigate`, `goBack`, `contextId`
- `useToast` from `@/hooks/use-toast`
- `fadeUp` animation pattern from framer-motion
- Cards: `bg-white rounded-2xl border border-gray-100 p-4 shadow-sm`
- CTAs: `bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20`
- `formatBDT()` for BDT currency formatting
- Tier colors: BRONZE/SILVER/GOLD/PLATINUM with specified color schemes
- All required shadcn/ui imports (Skeleton, Badge, Button, Input, Label, Tabs, Dialog, AlertDialog)
- Icons from `lucide-react`

## API Endpoints Used
1. `GET /api/businesses/${BUSINESS_ID}/cctv/customers/${contextId}` — Customer detail
2. `GET /api/businesses/${BUSINESS_ID}/cctv/customers/${contextId}/loyalty` — Loyalty transactions
3. `POST /api/businesses/${BUSINESS_ID}/cctv/customers/${contextId}/loyalty` — Manual adjust
4. `POST /api/businesses/${BUSINESS_ID}/cctv/customers/${contextId}/redeem` — Redeem points
5. `GET /api/businesses/${BUSINESS_ID}/cctv/loyalty-config` — Loyalty config (redeem rate)

## Lint
- `eslint CCTVCustomerDetail.tsx` passed with zero errors/warnings