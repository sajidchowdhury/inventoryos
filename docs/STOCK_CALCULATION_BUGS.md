# CCTV Module Audit — Bugs & Recommended Fixes

> **Auditor:** External review (2026-09-08)
> **Scope:** CCTV module
>   - Sections 1–7: Stock-calculation audit (purchase / sale / stock-report / product-movement / purchase-report / sales-report)
>   - Section 8: Inventory-section feature audit (products list, product form, categories, CSV import, serial search, stock report UI)
> **Status:** Open — fixes not yet applied

---

## TL;DR

Stock math for **non-serial** CCTV products is correct and race-safe.
Stock math for **serial-tracked** CCTV products is **partially broken**: the `CCTVProduct.stock` column is incremented on purchase but never decremented on sale. Reader endpoints work around this in *some* places (Stock Report, Dashboard) but not everywhere (Products List), and aggregation reports (Purchase Report, Sales Report, Product Movement running balance) are accurate only if the frontend always sends a `quantity` field that matches the actual serial count.

Two related bugs exist in the "add item to existing sale" endpoint that allow double-selling the same serial and creating out-of-balance books.

The Inventory-section audit (Section 8) found 6 more critical/high bugs:
- **No product edit or delete endpoint exists** — once a product is created, it cannot be modified through the API or UI (F-1).
- **CSV-imported serial-tracked products get a `stock=N` field but zero serial items** — Stock Report then shows 0, contradicting the imported value (I-1).
- **Products List API ignores `?limit=` and caps at 50** — UI asks for 100, gets 50, and then filters client-side on those 50, hiding products past row 50 from search results (P-1, P-3).
- **CSV import is not transactional and doesn't re-validate rows server-side** — partial imports and frontend-bypass are both possible (I-3, I-4).

---

## 1. The Core Bug — serial-tracked stock is never decremented on sale

### Files

- `src/app/api/businesses/[id]/cctv/purchases/route.ts` — lines 148–151
- `src/app/api/businesses/[id]/cctv/sales/route.ts` — lines 94–147

### What happens

**Purchase** increments the product's stock by the number of serials:

```ts
// purchases/route.ts, lines 148–151
await tx.cCTVProduct.update({
  where: { id: item.productId },
  data: { stock: { increment: serials.length } },
});
```

**Sale** marks each serial `IN_STOCK → SOLD` and updates the serial's `sellPrice`, `saleDate`, `warrantyEnd`, `customerId`, `customerName` — but **never decrements `CCTVProduct.stock`**. Only the non-serial branch (lines 152–158) decrements stock.

### Repro

1. Buy a serial-tracked product (e.g. Hikvision DS-2CE16, 5 units, serials `S1..S5`).
2. Observe `CCTVProduct.stock = 5`, 5 serials with `status = IN_STOCK`.
3. Sell one unit (serial `S3`).
4. Observe: serial `S3` now `status = SOLD` ✅, but `CCTVProduct.stock` is still `5` ❌.
5. Hit `GET /api/businesses/[id]/cctv/products` → product list shows **5 in stock** even though only 4 are actually available.

### Why it matters

Any reader that uses `CCTVProduct.stock` directly is wrong after the first sale. Reports that have a per-reader workaround are correct, but the workaround is duplicated and fragile.

---

## 2. Per-report impact

| Reader | Uses | Verdict for serial-tracked | Verdict for non-serial |
|---|---|---|---|
| **Products List** (`GET /cctv/products`) | `CCTVProduct.stock` directly | ❌ Wrong (inflated) | ✅ Correct |
| **Stock Report** (`reports/stock`) | Override: `COUNT(serials WHERE status=IN_STOCK)` (lines 19–24) | ✅ Correct | ✅ Correct |
| **Dashboard** (`cctv/dashboard`) | Same IN_STOCK count override (lines 36–40, 52–56) | ✅ Correct | ✅ Correct |
| **Product Movement** (`reports/product-movement`) | Totals = IN_STOCK count (lines 99–104). Running balance = `Σ(qtyIn − qtyOut)` from `PurchaseItem.quantity` / `SaleItem.quantity` (lines 92–96) | ⚠️ Total correct, **running balance can drift** | ✅ Correct |
| **Purchase Report** (`reports/purchase-report`) | Sums `PurchaseItem.quantity` (line 46) | ⚠️ Wrong if frontend sends `quantity` ≠ `serials.length` | ✅ Correct |
| **Sales Report** (`reports/sales-report`) | Sums `SaleItem.quantity` (line 71) | ⚠️ Wrong if frontend sends `quantity` ≠ actual serials sold | ✅ Correct |

### Why the aggregation reports are fragile

In `purchases/route.ts` the code stores **both** `item.quantity` (whatever the frontend sent) and the actual `serialNumbers` string on the same `PurchaseItem` row, then increments `CCTVProduct.stock` by `serials.length` (line 150), not by `item.quantity`. If the frontend sends `quantity: 1` with three serials pasted into `serialNumbers`, stock goes up by 3 but the Purchase Report shows 1 unit bought. The two fields can diverge silently.

---

## 3. Secondary bug — "add item to existing sale" is unsafe

### File

`src/app/api/businesses/[id]/cctv/sales/[saleId]/items/route.ts`

### Problems

1. **Not wrapped in `$transaction`.** Sale item creation, sale total recalculation, and stock decrement are three separate writes. If any one fails, the previous ones are already committed.
2. **Stock decrement is not atomic.** Line 56–60 uses a plain `db.cCTVProduct.update({ data: { stock: { decrement: qty } } })` — no `WHERE stock >= qty` guard. Under concurrency this can drive stock negative. (The main sale flow on `sales/route.ts` line 152–158 uses `updateMany` with `stock: { gte: qty }` and checks `updated.count === 0` — that's the correct pattern.)
3. **Serial items are not marked SOLD.** Line 34 stores `serialNumber` on the new SaleItem, but the matching `CCTVSerialItem` row is never updated. The serial stays `IN_STOCK` → the same serial can be sold again on another sale.
4. **No stock-movement audit row.** Main sale flow writes a `CCTVStockMovement` (line 176); this flow does not. Product Movement report will miss items added this way.
5. **No ledger entries.** Main sale flow calls `createLedgerEntries` (line 245); this flow does not. Books go out of balance.

### Repro for double-sell

1. Create sale S1 with product P (non-serial, qty 1). Stock goes from 5 → 4.
2. Add the same product P (qty 1) to S1 via `POST /sales/S1/items`. Stock goes 4 → 3.
3. Look at S1's items — two line items for P, but only one sale. Reports show P sold once but stock dropped twice. **Acceptable** if that's the intent, but the sale total now shows 2 units of P that the customer only really received 1 of (depending on UI flow).

For serial items it's worse:

1. Create sale S1 with serial `S3`. Serial `S3` is marked SOLD.
2. Add another line to S1 with the same serial `S3` (or any serial still IN_STOCK). The new SaleItem stores the serial string, but the `CCTVSerialItem` is never updated → it's still IN_STOCK.
3. Create sale S2 with the same serial `S3` via the main flow. Main flow checks `status: IN_STOCK`, finds it, marks it SOLD.
4. Now `S3` is "sold" twice — on S1 line 2 and on S2.

---

## 4. Recommended fixes (in priority order)

### Fix 1 — Decrement product stock on serial sale (core bug)

In `src/app/api/businesses/[id]/cctv/sales/route.ts`, inside the serial-item branch, after marking the serial SOLD (around line 131), add:

```ts
// Decrement the product's stock column to match the serial count
await tx.cCTVProduct.update({
  where: { id: item.productId },
  data: { stock: { decrement: 1 } },
});

// Audit record (mirrors the non-serial branch)
const productAfter = await tx.cCTVProduct.findUnique({
  where: { id: item.productId },
  select: { name: true, stock: true },
});
await tx.cCTVStockMovement.create({
  data: {
    businessId,
    productId: item.productId,
    productName: productAfter?.name || item.productName,
    movementType: "SALE",
    quantityChange: -1,
    balanceAfter: productAfter?.stock ?? 0,
    referenceId: createdSale.id,
    referenceType: "sale",
    notes: `Sale to ${body.customerName || "walk-in customer"} (serial: ${item.serialNumber})`,
  },
});
```

After this fix, the `stock` column will always reflect reality. The per-reader overrides in Stock Report and Dashboard can stay (defensive) but are no longer load-bearing.

### Fix 2 — Make "add item to sale" safe and transactional

Rewrite `src/app/api/businesses/[id]/cctv/sales/[saleId]/items/route.ts` to:

1. Wrap everything in `db.$transaction(async (tx) => { ... })`.
2. For serial items, atomically find a serial with `serialNumber = body.serialNumber AND status = IN_STOCK`, throw if not found, then update it to `SOLD` (same pattern as the main sale flow at lines 96–131).
3. For non-serial items, use `updateMany` with `where: { id, stock: { gte: qty } }` and check `updated.count === 0` to detect insufficient stock (same pattern as main flow lines 152–158).
4. Always write a `CCTVStockMovement` row.
5. Always create ledger entries (call `createLedgerEntries` with DEBIT cash/receivable + CREDIT sales_revenue, same as main sale flow lines 210–245).
6. Recompute the sale's `subtotal`/`totalAmount`/`dueAmount` from the new full item list (the existing code does this on lines 39–41, but it must happen inside the transaction and the `discount` field must be respected, which the current code ignores).

### Fix 3 — Make `PurchaseItem.quantity` and `serials.length` consistent

In `src/app/api/businesses/[id]/cctv/purchases/route.ts`, after parsing serials (around line 104), enforce consistency:

```ts
// If serials were provided, quantity MUST equal serials.length
if (item.serialNumbers && item.serialNumbers.trim()) {
  const serials = item.serialNumbers
    .split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean);
  // Either trust serials.length and overwrite quantity...
  item.quantity = serials.length;
  // ...or reject if frontend sent a different quantity:
  // if (item.quantity && item.quantity !== serials.length) {
  //   throw new Error(`Product ${item.productName}: quantity (${item.quantity}) does not match serial count (${serials.length})`);
  // }
}
```

Pick one strategy (auto-correct is friendlier; reject is stricter). After this fix, Purchase Report and Stock Report can never disagree.

### Fix 4 — Make Product Movement running balance match actual stock for serial items

In `src/app/api/businesses/[id]/cctv/reports/product-movement/route.ts`, when the product is serial-tracked, replace the running-balance computation (lines 92–96) with a serial-aware one. The simplest fix: recompute each `qtyIn` from the count of serials purchased (parse `PurchaseItem.serialNumbers`), and each `qtyOut` from the count of `SaleItem` rows that have a non-null `serialNumber` for that product. Then `Σ(qtyIn − qtyOut)` will equal `currentStock`.

A cleaner alternative: drop the synthetic running balance entirely for serial-tracked products and instead pull the truth from `CCTVSerialItemHistory` (each PURCHASED event = +1, each SOLD event = -1). That gives you a fully audited ledger that always reconciles.

### Fix 5 — Add an invariant test

Add a script (e.g. `scripts/stock-invariant-test.ts`) that, for every CCTV product, asserts:

```
CCTVProduct.stock == COUNT(CCTVSerialItem WHERE status=IN_STOCK)   // serial-tracked
CCTVProduct.stock == Σ(PurchaseItem.quantity) − Σ(SaleItem.quantity)  // non-serial
```

Run it in CI. Any drift is a regression.

---

## 5. Non-issues / things that ARE done well

- Main sale flow is wrapped in `db.$transaction` (line 58) — atomic, rolls back cleanly on failure.
- Main sale flow's non-serial stock check uses `updateMany` with `stock: { gte: qty }` and checks `updated.count === 0` (lines 152–158) — **race-safe**, no negative stock possible.
- Stock Report and Dashboard both have the IN_STOCK serial count override — so the operator's "current stock" view is correct even without the fix.
- Stock Movement audit rows are written on the main purchase and sale flows — so an audit trail exists for the primary paths.
- Serial history (`CCTVSerialHistory`) is written inside the transaction — full lifecycle is captured.
- `serializeDecimals` is consistently used — no float precision issues in responses.

---

## 6. Repro script (manual)

```bash
# 1. Spin up the stack
docker compose up -d
bunx prisma migrate deploy
bunx prisma db seed
bun run dev

# 2. Log in as a CCTV business at http://localhost:3000

# 3. Create a serial-tracked product (e.g. "Hikvision DS-2CE16", serialTracked=true)

# 4. Buy 5 units with serials S1..S5

# 5. Open Products List — verify stock = 5

# 6. Sell 1 unit (serial S3)

# 7. Open Products List — BUG: stock still shows 5 (should be 4)

# 8. Open Stock Report — CORRECT: shows 4 (uses IN_STOCK count override)

# 9. Open Product Movement — TOTAL shows 4, but running balance last row = 4
#    ONLY if frontend sent quantity=1 on the sale; otherwise running balance drifts

# 10. Open Sales Report — shows 1 unit sold IF frontend sent quantity=1
```

---

## 7. Files to touch when implementing fixes

| File | Fix |
|---|---|
| `src/app/api/businesses/[id]/cctv/sales/route.ts` | Fix 1 — decrement product stock on serial sale |
| `src/app/api/businesses/[id]/cctv/sales/[saleId]/items/route.ts` | Fix 2 — transactional, atomic, serial-marking, ledger-aware |
| `src/app/api/businesses/[id]/cctv/purchases/route.ts` | Fix 3 — enforce `quantity === serials.length` |
| `src/app/api/businesses/[id]/cctv/reports/product-movement/route.ts` | Fix 4 — serial-aware running balance |
| `scripts/stock-invariant-test.ts` (new) | Fix 5 — CI invariant check |
| See Section 8 for Inventory-section files | Per-feature fixes (Products List, Product Form, Categories, CSV Import, Serial Search, Stock Report UI) |

---

## 8. Inventory Section Feature Audit

This section audits the six Inventory-section features end-to-end (API + UI component), beyond the core stock-calculation bug covered in Sections 1–7.

Bug IDs are prefixed with the feature letter: **P**roducts List, **F**orm, **C**ategories, **I**mport, **S**erial Search, **R**eport.

### 8.1 Products List

**Files:** `src/app/api/businesses/[id]/cctv/products/route.ts` · `src/modules/cctv-shop/components/CCTVProductsList.tsx`

| ID | Severity | Bug |
|---|---|---|
| **P-1** | High | API ignores `?limit=100` query param — hardcoded `take: 50` (line 23). UI asks for 100 (line 40), gets 50. Shops with >50 products silently lose half their catalog from the list view. |
| **P-2** | High | No pagination UI or "load more". Once 50 is hit, there is no way to see the rest of the products. |
| **P-3** | High | Client-side filtering: `useEffect` fetches once (max 50 rows), then `useState` filter runs on that cached list (lines 46–51). If a user searches for a product that exists at row 60, they get "No products found" even though the product exists in the DB. |
| **P-4** | High | UI shows `product.stock` directly (line 148), inheriting the core stock bug from Section 1. For serial-tracked products the displayed stock is wrong (inflated, never decremented on sale). |
| **P-5** | Medium | API response doesn't include `pagination` metadata (only `total`). UI can't tell if more pages exist. |

**Recommended fixes:**
- Honor `?limit=` and `?offset=` in the API. Add `pagination: { page, pageSize, total, totalPages }` to the response (same shape as `purchases/route.ts` line 30).
- Push search to the server (debounced GET with `?search=`) instead of client-side filter on cached rows.
- For serial-tracked products, return `effectiveStock = COUNT(IN_STOCK serials)` instead of raw `cCTVProduct.stock` (same override as Stock Report route, lines 19–24). After applying Fix 1 from Section 4, this becomes a non-issue.

### 8.2 Product Form

**Files:** `src/app/api/businesses/[id]/cctv/products/route.ts` (POST only) · `src/modules/cctv-shop/components/CCTVProductForm.tsx`

> **⚠️ There is no `src/app/api/businesses/[id]/cctv/products/[productId]/route.ts` file at all.** The `products/` directory contains only `route.ts` and `import/route.ts`. This is the root cause of F-1.

| ID | Severity | Bug |
|---|---|---|
| **F-1** | **Critical** | **No product edit or delete endpoint exists.** Once a product is created, it cannot be modified through the API or UI. The nav store has an `edit-product` view (per `CCTVShell.tsx`), but `CCTVProductForm.tsx` has no edit logic — header always says "Add Product" (line 92) and `handleSubmit` always uses POST (line 49). There is no GET-by-id, no PATCH/PUT, no DELETE. |
| **F-2** | Medium | `parseInt(form.stock) \|\| 0` silently coerces invalid input ("abc") to 0 instead of erroring (line 61). |
| **F-3** | Medium | No SKU uniqueness check, and no `@@unique([businessId, sku])` constraint in `prisma/schema.prisma`. Two products with the same SKU can coexist. |
| **F-4** | Low | Form doesn't validate `costPrice <= sellPrice` — allows negative margin by accident. |
| **F-5** | Low | Form has no "delete" affordance anywhere. Combined with F-1, products are effectively immutable once created. |

**Recommended fixes:**
- Add `src/app/api/businesses/[id]/cctv/products/[productId]/route.ts` with:
  - `GET` — single product by id (must verify `businessId` matches)
  - `PATCH` — edit fields (name, brand, model, sku, categoryId, costPrice, sellPrice, minStock, warrantyMonths, unit, isActive, imageUrl)
  - `DELETE` — soft-delete (`isActive: false`) by default; hard-delete only if no purchases/sales/serials reference it
- Update `CCTVProductForm.tsx` to detect the `edit-product` view (read `contextId` from `useCCTVNavStore`), pre-fill the form via GET, change submit to PATCH. The header should switch between "Add Product" and "Edit Product".
- Add `@@unique([businessId, sku])` to the `CCTVProduct` model in `prisma/schema.prisma` and create a new migration. (Optional — only if SKU uniqueness is a business requirement.)

### 8.3 Categories

**Files:** `src/app/api/businesses/[id]/cctv/categories/route.ts` · `src/app/api/businesses/[id]/cctv/categories/[categoryId]/route.ts` · `src/modules/cctv-shop/components/CCTVCategories.tsx`

| ID | Severity | Bug |
|---|---|---|
| **C-1** | Medium | POST `/categories` returns the category object directly (`NextResponse.json(category, { status: 201 })`, line 24), not wrapped in `{ success: true, category }`. PATCH returns `{ success: true, category }`. Inconsistent — the UI happens to not check `success` on create so it works, but any future consumer will be confused. |
| **C-2** | Medium | POST doesn't check for duplicate slug. Schema has `@@unique([businessId, slug])`, so a duplicate name will throw P2002 → UI shows generic "Failed" toast. Should pre-check and append `-2`, `-3`, etc. |
| **C-3** | Medium | PATCH auto-regenerates slug from name (line 19). If you rename "Cameras" to "Cables & Accessories" and another category with that slug exists, you get P2002 on PATCH. Should use the same unique-slug helper as POST. |
| **C-4** | Low | UI doesn't expose the `icon` picker even though `icon` is a stored field. Only color is editable in the dialog. |
| **C-5** | Low | UI edit dialog doesn't expose `isActive` toggle — can't deactivate a category from UI (only via direct API call). |
| **C-6** | Low | UI create request body includes `slug` (line 79 of `CCTVCategories.tsx`), but the API ignores it (auto-generates from name). Dead payload. |

**Recommended fixes:**
- Wrap POST response: `return NextResponse.json({ success: true, category }, { status: 201 })`.
- Add a shared `ensureUniqueSlug(businessId, baseSlug)` helper in `src/lib/slug.ts` that appends `-2`, `-3`, etc. until unique. Use in both POST and PATCH.
- Add an icon picker (or remove the `icon` column from the schema if it's unused).

### 8.4 Import Products (CSV)

**Files:** `src/app/api/businesses/[id]/cctv/products/import/route.ts` · `src/modules/cctv-shop/components/CCTVImportProducts.tsx` · `public/templates/product-import-template.csv`

| ID | Severity | Bug |
|---|---|---|
| **I-1** | **Critical** | **Serial-tracked import creates products with `stock=N` but zero `CCTVSerialItem` rows.** A CSV row with `serialTracked=true, stock=5` inserts a `CCTVProduct` with `stock=5` and zero serials. Stock Report's IN_STOCK count override (Section 2) then shows **0** — direct contradiction with the imported `stock=5`. The product's `stock` field and the actual serial count disagree permanently. |
| **I-2** | High | Import does NOT create `CCTVStockMovement` audit rows. Initial stock from CSV is invisible to the Product Movement report — the running balance starts at 0 and the first entry will be the first sale, not the initial stock-in. |
| **I-3** | High | Import is NOT wrapped in `db.$transaction`. If row 50 of 100 fails with a database error, rows 1–49 are already committed, and `skippedCount` reports only the one failure. The shop is left in a partial-import state with no rollback path. |
| **I-4** | High | Import doesn't re-validate `rows` server-side. It trusts the frontend's `status` field (line 113: `rows.filter(r => r.status !== "error")`). A malicious or buggy frontend can submit rows with `status: "valid"` and missing `name` — Prisma won't throw (name is non-nullable in schema, so it would throw actually), but other invalid combinations (negative stock, bad category references) will silently insert. |
| **I-5** | High | Master catalog matching is too loose (lines 161–173): `OR: [{ brand, model }, { name: { contains: row.data.name, mode: "insensitive" } }]`. A row with brand "Generic" matches ALL master products with brand "Generic". A row named "Cat6 Cable" matches any master product whose name contains "Cat6 Cable". False positive links pollute the master-catalog relationship. |
| **I-6** | Medium | CSV parser is hand-rolled (lines 16–43). Doesn't handle: (a) UTF-8 BOM — Excel "UTF-8" export prepends `\uFEFF` so the first header becomes `\uFEFFname` and silently fails to map; (b) multiline quoted fields — a description with an embedded newline is split into two rows; (c) escaped quotes inside quoted fields are partially handled but edge cases exist. Use a proper CSV parser (`csv-parse` or `papaparse`). |
| **I-7** | Medium | CSV template at `public/templates/product-import-template.csv` does NOT include the `serialTracked` column, even though the UI's "CSV Columns" reference (lines 174–184 of `CCTVImportProducts.tsx`) lists it. Users downloading the template will miss this field — `serialTracked` defaults to `false` on import. |
| **I-8** | Medium | Dedup is by exact match on `name + brand` (lines 145–151, case-sensitive). Existing "hikvision DS-2CD" doesn't match incoming "Hikvision DS-2CD" → duplicate product created. Use case-insensitive comparison. |
| **I-9** | Medium | `parseInt(row.data.stock) \|\| 0` accepts negative numbers. `stock="-5"` becomes -5. No `>= 0` validation. |
| **I-10** | Low | UI stores parsed `rows` only in component state — not persisted to localStorage. A page refresh during preview loses all parsed data; user must re-upload the CSV. |
| **I-11** | Low | UI "Imported" success view only shows `importedCount` and `skippedCount` (lines 289–295). The API also returns `masterCatalogLinked` (line 207), but the UI never displays it. |

**Recommended fixes:**
- For **I-1**: If `serialTracked=true`, do NOT allow `stock > 0` from CSV — the serial-tracked workflow requires stock-in flow to add serials one by one. Either reject the row with a clear warning ("Serial-tracked products need stock added via Stock-In screen, not CSV import") or force `stock = 0` and add a note. Then create a `CCTVStockMovement` with `movementType: "INITIAL_IMPORT"` explaining the initial state.
- For **I-2**: After each successful product insert, create a `CCTVStockMovement` with `movementType: "INITIAL_IMPORT"`, `quantityChange: stock`, `balanceAfter: stock`, and `referenceType: "csv_import"`.
- For **I-3**: Wrap the entire `import` action in `db.$transaction(async (tx) => { ... })`. Any failure rolls back all inserts.
- For **I-4**: Re-run `validateRow` server-side before inserting. Reject rows with `status === "error"` regardless of what the frontend sent. Don't trust the `status` field from the client.
- For **I-5**: Tighten master catalog match: require `brand` AND `model` exact match (case-insensitive). Drop the `name contains` clause, or make it a fallback only if `brand + model` doesn't match.
- For **I-6**: Replace the hand-rolled parser with `csv-parse/sync` (already a transitive dep via other libs) or `papaparse`.
- For **I-7**: Add `serialTracked` column to the CSV template, or remove it from the UI's column reference list.

### 8.5 Serial Search & History

**Files:** `src/app/api/businesses/[id]/cctv/serial-items/route.ts` · `src/app/api/businesses/[id]/cctv/serial-history/route.ts` · `src/modules/cctv-shop/components/CCTVSerialSearch.tsx`

| ID | Severity | Bug |
|---|---|---|
| **S-1** | Medium | UI displays the product's default warranty months (`item.product.warrantyMonths`, line 318), not the actual serial's `warrantyMonths` (which can be overridden at purchase time, see `purchases/route.ts` lines 112–114). If a serial was bought with extended warranty, the search shows the product default — misleading for warranty claims. |
| **S-2** | Medium | API doesn't paginate history. A serial with 1000 events returns all 1000 rows; UI renders all 1000 in the timeline (line 269). Performance issue for high-volume serials. |
| **S-3** | Medium | N+1 query pattern: for each of up to 20 serial items, 3 separate queries run (history + replacement + replacesSerialId, lines 30–66). Up to 60 queries per search. Should batch. |
| **S-4** | Low | The "no search" branch of the API (lines 77–93) returns 50 recent history entries, but the UI never calls the endpoint without a search query. Dead code path. |
| **S-5** | Low | `STATUS_STYLES`, `EVENT_ICONS`, and `EVENT_COLORS` maps are hardcoded in the component (lines 62–94). Any new status or event type added later renders with a raw string and default gray icon. Not future-proof. |
| **S-6** | Low | Auto-expand first result on search (lines 144–147). If user wants to expand a different one, they must click the first to collapse, then click the one they want. Minor UX. |

**Recommended fixes:**
- For **S-1**: Change line 318 from `item.product.warrantyMonths` to `item.warrantyMonths ?? item.product.warrantyMonths`.
- For **S-2**: Add `take: 50` to the history fetch and a "Show more" button in the UI.
- For **S-3**: Use a single `findMany` with `include: { history: true }` and a single `findMany` for replacements with `where: { businessId, originalSerialItemId: { in: serialIds } }`. Reduces 60 queries to 2.
- For **S-5**: Move status/event maps to `src/modules/cctv-shop/types/index.ts` and throw on missing entries in dev mode (fail fast on schema additions).

### 8.6 Stock Report (UI)

**Files:** `src/app/api/businesses/[id]/cctv/reports/stock/route.ts` · `src/modules/cctv-shop/components/CCTVStockReport.tsx`

> The API endpoint is already covered in Section 2 (Stock Report row — verdict ✅ correct for both serial and non-serial). This subsection audits only the UI.

| ID | Severity | Bug |
|---|---|---|
| **R-1** | Medium | UI requires manual "Load Stock" button click (line 79) — doesn't auto-load on mount. Empty state literally shows "Click 'Load Stock' to view inventory" (line 105). Unusual UX; every other report auto-loads. |
| **R-2** | Medium | API returns `outOfStockCount` in summary (route line 48), but UI never displays it. Only 4 summary cards are rendered (lines 110–127): total products, stock value (cost), stock value (sell), low stock. Missing out-of-stock card. |
| **R-3** | Low | `window.print()` prints the entire page, including the CCTV shell sidebar and bottom nav. `print:hidden` is applied to the report header (line 74), but not to the rest of the app shell. May print nav chrome. |
| **R-4** | Low | No filter/sort options in the UI. API returns products sorted by `stock: asc` only. UI can't filter by category, search by name, or sort by value. |
| **R-5** | Low | No auto-refresh. If a sale happens, the stock report still shows old data until user clicks "Load Stock" again. Acceptable for a report but worth noting. |

**Recommended fixes:**
- For **R-1**: Change the initial render to auto-load. Replace the manual `handleSearch` button click with `useEffect(() => { if (businessId) handleSearch() }, [businessId])`. Keep the button as a "Refresh" affordance.
- For **R-2**: Add a 5th summary card showing `outOfStockCount` (red, alongside low stock).
- For **R-3**: Add `print:hidden` to `CCTVShell.tsx`'s sidebar and bottom nav, or add a global `@media print` rule in `globals.css` that hides `.cctv-shell-nav`.

### 8.7 Priority summary across the Inventory section

| Priority | Bug IDs | What to fix first |
|---|---|---|
| **P0** (blocks normal use) | F-1, I-1 | Add product edit/delete endpoint; fix serial-tracked CSV import (reject `stock > 0` or force `stock = 0`) |
| **P1** (data correctness) | P-1, P-3, P-4, I-2, I-3, I-4, S-1 | Honor `?limit=`, server-side search, serial-aware stock in list, stock-movement audit rows on import, transactional import, server-side re-validation, show actual serial warranty months |
| **P2** (UX / consistency) | C-1, C-2, C-3, I-5, I-6, I-7, I-8, R-1, R-2 | Response shape consistency, slug collision handling, tighten master-catalog matching, proper CSV parser, add `serialTracked` to template, case-insensitive dedup, auto-load stock report, show out-of-stock count |
| **P3** (polish) | F-2, F-3, F-4, F-5, C-4, C-5, C-6, I-9, I-10, I-11, S-2, S-3, S-4, S-5, S-6, R-3, R-4, R-5 | Validation hardening, missing UI affordances, performance, dead code cleanup |

### 8.8 Files to touch for Section 8 fixes

| File | Fix IDs |
|---|---|
| `src/app/api/businesses/[id]/cctv/products/route.ts` | P-1, P-3, P-4, P-5 |
| `src/app/api/businesses/[id]/cctv/products/[productId]/route.ts` (new) | F-1, F-5 |
| `src/modules/cctv-shop/components/CCTVProductForm.tsx` | F-1, F-2, F-4 |
| `src/modules/cctv-shop/components/CCTVProductsList.tsx` | P-2, P-3 |
| `prisma/schema.prisma` + new migration | F-3 (`@@unique([businessId, sku])`) |
| `src/app/api/businesses/[id]/cctv/categories/route.ts` | C-1, C-2 |
| `src/app/api/businesses/[id]/cctv/categories/[categoryId]/route.ts` | C-3 |
| `src/modules/cctv-shop/components/CCTVCategories.tsx` | C-4, C-5, C-6 |
| `src/lib/slug.ts` (new) | C-2, C-3 |
| `src/app/api/businesses/[id]/cctv/products/import/route.ts` | I-1, I-2, I-3, I-4, I-5, I-6, I-8, I-9 |
| `src/modules/cctv-shop/components/CCTVImportProducts.tsx` | I-7, I-10, I-11 |
| `public/templates/product-import-template.csv` | I-7 |
| `src/app/api/businesses/[id]/cctv/serial-history/route.ts` | S-2, S-3, S-4 |
| `src/modules/cctv-shop/components/CCTVSerialSearch.tsx` | S-1, S-5, S-6 |
| `src/app/api/businesses/[id]/cctv/reports/stock/route.ts` | (already covered in Section 2) |
| `src/modules/cctv-shop/components/CCTVStockReport.tsx` | R-1, R-2, R-4 |
| `src/app/globals.css` or `src/modules/cctv-shop/components/CCTVShell.tsx` | R-3 |

---

*End of audit report.*
