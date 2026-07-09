---
Task ID: 6-7
Agent: Warranty UI Agent
Task: CCTV Warranty Tracking and Alerts — UI Components

Work Log:
- Read worklog.md for project conventions and existing patterns
- Studied existing components (CCTVJobCardsList, CCTVSaleDetail, CCTVJobCardDetail) for API integration patterns
- Verified CCTVViewType includes 'warranties' and 'warranty-detail'
- Confirmed `formatBDT` is defined locally (not imported) per project convention
- Confirmed `ease: 'easeOut'` must be replaced with `ease: [0, 0, 0.2, 1]`

File 1: CCTVWarrantiesList.tsx (rewritten)
- Replaced all mock data with real API calls
- `GET /api/businesses/${BUSINESS_ID}/cctv/warranties?search=...&status=...` for list
- `GET /api/businesses/${BUSINESS_ID}/cctv/warranties/summary` for summary stats
- Summary stats row: 3 cards (Active/emerald, Expiring Soon/amber, Expired/red)
- Pending claims alert card when claims.pending > 0
- Search with 300ms debounce (separate searchInput/search state)
- Filter tabs: All / Active / Expiring Soon / Expired (server-side status param)
- Warranty cards: product name + brand, serial number (mono), warranty status badge, customer name, phone (tap-to-call), warranty period with start/end dates, days remaining color-coded, claims count badge
- Tap navigates to warranty-detail with serialItemId as context
- Skeleton loading state, empty state with contextual message
- Uses Input, Skeleton, Badge from shadcn/ui

File 2: CCTVWarrantyDetail.tsx (new)
- Fetches serial item via `GET /api/businesses/${BUSINESS_ID}/cctv/serial-items/${contextId}`
- Fetches claims via `GET /api/businesses/${BUSINESS_ID}/cctv/warranty-claims?serialItemId=${contextId}`
- Warranty Status Card: large gradient card colored by status (ACTIVE=green, EXPIRING_SOON=amber, EXPIRED=red) with decorative circles, shield icons, date grid
- Product Info Card: name, brand, serial number, IMEI, status badge, sell price
- Customer Card: name, phone (tap-to-call), "View Sale" link if saleId exists
- New Claim Button (violet CTA): only shown for ACTIVE or EXPIRING_SOON warranties, opens Dialog with issue description textarea, pre-filled customer name/phone
- Claims History Section: status badges with 6 color configs (PENDING=amber, APPROVED=blue, IN_PROGRESS=violet, COMPLETED=emerald, REJECTED=red, CANCELLED=gray)
  - PENDING: Approve + Reject (with AlertDialog confirmation) buttons
  - APPROVED: Start Repair button
  - IN_PROGRESS: Complete button opening Dialog with resolution notes textarea
- Timeline Section: serial item history with dot+line timeline, relative dates
- Loading: Skeleton, Error: retry button
- All actions use toast notifications
- Fixed lint error (react-hooks/set-state-in-effect) by using cancelled flag pattern
- Uses Dialog, AlertDialog, Button, Input, Textarea, Label, Badge, Skeleton from shadcn/ui

Lint: passes clean