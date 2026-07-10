# Task 11 — CCTVLoyaltyCenter Component

**Agent:** Main Agent  
**Segment:** 3C — Customer Loyalty & CRM

## Work Done

Created `/home/z/my-project/src/modules/cctv-shop/components/CCTVLoyaltyCenter.tsx` — a comprehensive loyalty program management screen for the CCTV Shop module.

### Features Implemented

1. **Header**: Back button via `goBack()` + "Loyalty Program" title
2. **Status Card**: Large toggle switch to enable/disable loyalty program with green/gray indicator, active offers count
3. **Earning Rules Card**: Editable inputs for points per event and amount per event (BDT), with live preview text
4. **Redemption Rules Card**: Editable inputs for points required and BDT value, with live preview text
5. **Tier Thresholds Card**: 4 rows (Bronze/Silver/Gold/Platinum) with editable BDT inputs and color-coded badges
6. **Save Config Button**: Violet gradient CTA, PUTs to config API, toast on success
7. **Promotional Offers Section**: Heading with count badge + "Create Offer" button
8. **Offer Cards**: Name + type badge, date range, status dot (Active/Scheduled/Expired), description, multiplier/bonus info, toggle switch, edit button, delete with AlertDialog confirmation
9. **Create/Edit Offer Dialog**: Name input, type select (DOUBLE_POINTS/BONUS_POINTS), conditional multiplier/bonus fields, date range inputs, description textarea, POST/PUT submit
10. **Empty State**: Shown when no offers exist
11. **Loading State**: Skeleton placeholders while fetching config and offers

### API Endpoints Used
- `GET /api/businesses/${BUSINESS_ID}/cctv/loyalty-config`
- `PUT /api/businesses/${BUSINESS_ID}/cctv/loyalty-config`
- `GET /api/businesses/${BUSINESS_ID}/cctv/loyalty-offers?active=true`
- `POST /api/businesses/${BUSINESS_ID}/cctv/loyalty-offers`
- `PUT /api/businesses/${BUSINESS_ID}/cctv/loyalty-offers/${offerId}`
- `DELETE /api/businesses/${BUSINESS_ID}/cctv/loyalty-offers/${offerId}`

### Conventions Followed
- `'use client'` at top
- Named export only: `export function CCTVLoyaltyCenter()`
- `useCCTVNavStore` / `goBack()`
- `useToast` from `@/hooks/use-toast`
- `BUSINESS_ID = 'bus_placeholder'`
- `.cctv-shell-wrap` container (480px max, centered — used by parent shell)
- Card style: `bg-white rounded-2xl border border-gray-100 p-4 shadow-sm`
- CTA style: `bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20`
- `motion` from `framer-motion` with `fadeUp` animation
- Icons from `lucide-react`
- `cn` from `@/lib/utils`
- Local `formatBDT` function matching project convention
- All specified shadcn/ui components imported and used
- No test code, no other route files
- ESLint passes cleanly