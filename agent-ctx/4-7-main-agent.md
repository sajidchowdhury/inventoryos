---
Task ID: 4-7
Agent: Main Agent
Task: Segment 3C - Customer Loyalty & CRM API Routes (5 files)

Work Log:
- Read worklog.md for conventions, confirmed patterns:
  - `{ params }: { params: Promise<{ id: string }> }` with `const { id: businessId } = await params;`
  - Nested params: `{ params }: { params: Promise<{ id: string; customerId: string }> }`
  - Import `db` from `@/lib/db`, `NextRequest`/`NextResponse` from `next/server`
  - Multi-tenant: all queries filter by `businessId`
  - Error pattern: throw string errors in tx, catch with `error instanceof Error ? error.message`, return specific status codes
- Reviewed Prisma schema: CCTVLoyaltyConfig (per-business unique), CCTVLoyaltyTransaction (append-only ledger), CCTVLoyaltyOffer (promotions with config relation), Customer (has loyaltyPoints, loyaltyTier, totalSpent)
- Noted Customer model has NO direct relation to CCTVLoyaltyTransaction; queried by `customerId` field
- Noted CCTVLoyaltyConfig has NO `name` field; used `select: { id: true }` for config includes

Files Created:

1. `/src/app/api/businesses/[id]/cctv/customers/[customerId]/loyalty/route.ts`
   - GET: Fetches loyalty transactions with optional type filter, limit/offset pagination; returns customer loyaltyPoints + loyaltyTier
   - POST: Manual points adjustment (ADJUST type); validates customer exists & active; prevents negative balance; recalculates tier via helper; creates transaction with balanceAfter snapshot; uses db.$transaction

2. `/src/app/api/businesses/[id]/cctv/customers/[customerId]/redeem/route.ts`
   - POST: Redeems points for discount; calculates full redemption units (Math.floor); validates config exists & active; deducts points; creates REDEEM transaction; returns pointsRedeemed, discountValue, remainingPoints, transaction

3. `/src/app/api/businesses/[id]/cctv/loyalty-config/route.ts`
   - GET: Fetches config by businessId; auto-initializes with defaults if not found; includes `_count: { select: { offers: true } }`
   - PUT: Updates existing config fields; validates numeric constraints; returns 404 if config doesn't exist (tells user to GET to auto-init)

4. `/src/app/api/businesses/[id]/cctv/loyalty-offers/route.ts`
   - GET: Lists offers with optional `active` (boolean) and `current` (active now between startDate/endDate) filters; includes config relation
   - POST: Creates offer; validates name, offerType (DOUBLE_POINTS/BONUS_POINTS), dates; auto-inits loyalty config if missing; sets appropriate defaults per offer type

5. `/src/app/api/businesses/[id]/cctv/loyalty-offers/[offerId]/route.ts`
   - GET: Fetches single offer by offerId + businessId
   - PUT: Updates offer fields (all optional); validates offerType, dates, type-specific fields; cross-validates against existing dates
   - DELETE: Soft-delete (sets isActive = false); returns `{ success: true }`

Validation:
- `bun run lint` passed with zero errors
- All 5 files follow exact conventions from existing codebase

Stage Summary:
- 5 API route files created for Customer Loyalty & CRM segment
- Full CRUD operations for loyalty config, offers, customer loyalty, and point redemption
- Tier calculation helper with configurable thresholds (defaults: 50K/200K/500K BDT)
- Auto-initialization pattern for loyalty config (GET creates default if missing)
- Transactional consistency for point mutations (adjust, redeem)