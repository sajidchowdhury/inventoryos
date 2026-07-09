# Task 3-5: Warranty Tracking and Alerts API Routes

## Agent: Main Agent

## Work Log:
- Read worklog.md for project conventions and Prisma schema
- Analyzed CCTVSerialItem and CCTVWarrantyClaim model fields (warrantyMonths, warrantyStart, warrantyEnd, customerName, customerPhone, saleId, serialNumber, imei, status)
- Studied existing route conventions (params pattern, error handling, import style) from sales/route.ts
- Created 4 API route files with lint passing (0 errors)

## Files Created:

### 1. `/src/app/api/businesses/[id]/cctv/warranties/route.ts`
- **GET**: Lists warranty serial items (status IN SOLD/WARRANTY_ACTIVE/WARRANTY_EXPIRED/INSTALLED with warrantyEnd set)
- Query params: `search`, `status` (ACTIVE/EXPIRING_SOON/EXPIRED), `days` (default 90)
- Computes `warrantyStatus` and `daysRemaining` in-memory after DB fetch
- Includes product relation (name, brand) and `_count.warrantyClaims`
- Sorted by warrantyEnd ascending (expiring first)

### 2. `/src/app/api/businesses/[id]/cctv/warranties/summary/route.ts`
- **GET**: Warranty statistics endpoint
- Uses 4 parallel Prisma count queries for ACTIVE/EXPIRING_SOON/EXPIRED/TOTAL based on warrantyEnd date ranges
- 5 parallel count queries for claims by status (PENDING/APPROVED/IN_PROGRESS/COMPLETED/REJECTED)
- Returns: `{ active, expiringSoon, expired, total, claims: { pending, approved, inProgress, completed, rejected } }`

### 3. `/src/app/api/businesses/[id]/cctv/warranty-claims/route.ts`
- **GET**: Lists warranty claims with serialItem relation (serialNumber, imei, product name/brand)
- Filters: `status`, `search` (customerName/customerPhone/issueDescription), `limit` (default 20)
- **POST**: Creates a warranty claim (status: PENDING)
- Validates: serialItemId exists, belongs to business, is active, has warrantyEnd, warranty not expired, issueDescription not empty
- Falls back to serial item's customerName/customerPhone if not provided

### 4. `/src/app/api/businesses/[id]/cctv/warranty-claims/[claimId]/route.ts`
- **GET**: Single claim with serialItem + product details
- **PUT**: Status transition with validation (PENDING→APPROVED/REJECTED, APPROVED→IN_PROGRESS/CANCELLED, IN_PROGRESS→COMPLETED)
- Sets approvedAt on APPROVED, completedAt on COMPLETED/REJECTED
- Accepts optional resolutionNotes and jobCardId
- **DELETE**: Soft-delete (isActive=false), only for PENDING or REJECTED claims

## Key Design Decisions:
- Warranty status computation done in-memory after DB fetch (Prisma can't compute date-based statuses natively)
- Summary route uses 9 parallel count queries for efficiency (no full item scan)
- Status transition map enforces state machine with terminal states (REJECTED/COMPLETED/CANCELLED)
- All routes follow established conventions: `{ params }: { params: Promise<...> }`, `await params`, `db` from `@/lib/db`