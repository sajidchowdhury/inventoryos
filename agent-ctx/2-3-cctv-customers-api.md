# Task 2-3: CCTV Customer Loyalty & CRM — Customer API Routes

## Agent: Main Agent

## Work Log
- Read worklog.md for project conventions (params Promise pattern, import db from @/lib/db, NextResponse.json(), multi-tenant businessId filtering)
- Studied existing route patterns: `cctv/sales/route.ts`, `customers/route.ts`, `customers/[customerId]/route.ts`
- Verified Prisma schema models: Customer (with loyaltyPoints, loyaltyTier, preferredPaymentMethod), CCTVSale (with customerId, totalDue, status, saleCode), CCTVEmiPlan (with customerPhone, remainingAmount, monthlyPayment, status), CCTVLoyaltyConfig (tier thresholds, earn/redeem rates)
- Created `/src/app/api/businesses/[id]/cctv/customers/route.ts`:
  - **GET**: Lists customers filtered by `search` (name/phone), `tier` (loyaltyTier), sorted by `sortBy`/`sortDir`. Includes `_count: { sales }` for pharmacy sales. Runs a separate `cCTVSale.groupBy()` to compute `cctvSalesCount` and `cctvTotalSpent` per customer, then merges into results.
  - **POST**: Create-or-lookup customer. If `phone` is provided, searches existing customer by businessId+phone; if found, updates name/email/address and returns 200. If not found, creates new customer with defaults (loyaltyPoints: 0, loyaltyTier: "BRONZE", totalSpent: 0, visitCount: 0) and returns 201.
- Created `/src/app/api/businesses/[id]/cctv/customers/[customerId]/route.ts`:
  - **GET**: Fetches single customer with parallel queries: cctvSalesCount, cctvTotalSpent (aggregate sum), emiPlansCount (matched by customerPhone), last 5 CCTVSale records, active CCTVEmiPlan records, and CCTVLoyaltyConfig. Computes active EMI remaining amount. Calculates tier progress (next tier + threshold). Returns combined profile object with `stats`, `recentSales`, `activeEmiPlans`, `loyaltyConfig`, `tierProgress`.
  - **PUT**: Updates customer fields (name, phone, email, address, preferredPaymentMethod, notes). Validates phone uniqueness if changing. Returns updated customer.
- Lint check: zero errors

## Files Created
1. `src/app/api/businesses/[id]/cctv/customers/route.ts` — GET list + POST create/lookup
2. `src/app/api/businesses/[id]/cctv/customers/[customerId]/route.ts` — GET detail + PUT update

## Conventions Followed
- `{ params }: { params: Promise<{ id: string }> }` with `await params`
- Import `db` from `@/lib/db`
- `NextResponse.json()` for all responses
- `NextRequest` for request parameter
- Multi-tenant: all queries filtered by `businessId`
- No `'use server'` in route files
- No named exports besides GET/POST/PUT
- Prisma model names: `db.customer`, `db.cCTVSale`, `db.cCTVEmiPlan`, `db.cCTVLoyaltyConfig`