# CCTV Module Audit — Bugs & Recommended Fixes

> **Auditor:** External review (2026-09-08)
> **Scope:** CCTV module
>   - Sections 1–7: Stock-calculation audit (purchase / sale / stock-report / product-movement / purchase-report / sales-report)
>   - Section 8: Inventory-section feature audit (products list, product form, categories, CSV import, serial search, stock report UI)
>   - Section 9: Sales-section feature audit (POS, sales invoice, estimates, payments)
>   - Section 10: Repairs & Service feature audit (repairs, repair token, warranty dashboard)
>   - Section 11: Customers & Expenses feature audit (customer ledger, due collection, expenses)
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

The Sales-section audit (Section 9) found 6 more critical/high bugs:
- **Estimate→Sale convert is NOT wrapped in a transaction** — partial failures leave an estimate un-converted but a sale is created, allowing duplicate conversions (E-1).
- **Estimate→Sale convert creates sale items with `costPrice: 0`** — P&L reports overstate profit by 100% margin on every converted sale (E-6).
- **Estimate→Sale convert skips ledger entries entirely** — books go out of balance whenever an estimate is converted (E-4).
- **Standalone payments don't update the linked sale's `paidAmount`/`dueAmount`** — the sale still shows "Due 1000" forever even after the customer paid (PM-3).
- **Standalone payments don't enforce `referenceId` linkage** — customer payments "float" with no sale to credit, so the invoice's "previous due" math double-counts (PM-1).
- **POS uses `?limit=100` but API caps at 50** — products past row 50 can't be added to a cart (SL-1).

The Repairs & Service audit (Section 10) found 5 more critical/high bugs:
- **Repair POST allows receiving a serial that's currently `IN_REPAIR` elsewhere** — no status check before transitioning to IN_REPAIR; a serial can be in two open repairs at once (RP-1).
- **Repair PATCH has no state-machine validation** — can skip `received → returned` directly, or move a `returned` repair back to `received`, leaving the serial stuck in `RETURNED_TO_CUSTOMER` forever (RP-3).
- **Repair PATCH sets serial to `IN_STOCK` on `ready`** — a serial still owned by the customer is now indistinguishable from sellable inventory; can be re-sold (RP-4).
- **Warranty Dashboard includes `RETURNED_TO_CUSTOMER` items in active/expiring/expired counts** — a returned product shouldn't be on the warranty dashboard at all, and once it is, it pollutes all three stats (W-1).
- **Repair `repairCost` is stored but never invoiced** — no payment is collected and no ledger entry is written; the shop's books silently miss all repair revenue (RP-7).

The Customers & Expenses audit (Section 11) found 5 more critical/high bugs:
- **Customer Ledger's "Returns" query is broken** — `cCTVReturn.findMany` joins `items` by `productId IN [sale.id]` (should be `saleId IN [sale.id]`); returns are silently dropped from every ledger. Also no `cctv/returns/` route exists, so returns can't actually be created anyway (CL-1).
- **Customer Ledger ignores standalone payments when computing the customer-list balances** — the customer-list endpoint (no `customerId`) sums `sale.totalAmount - sale.paidAmount` and never queries the `payments` table; balances diverge from the per-customer ledger which DOES include payments (CL-2).
- **No edit/delete customer endpoint exists** — once a customer is created, it can't be modified or removed; phone/typos are permanent (CU-1).
- **Due Collection's aging is computed from the oldest unpaid sale, not the oldest unpaid invoice by FIFO** — if a customer has a 6-month-old unpaid sale and a 1-day-old unpaid sale, both get aged by the oldest date, lumping the new sale into the "90+ days" bucket (DC-2).
- **Expenses POST hardcodes `paymentMethod` to cash via `paymentMethodToAccount` fallback** — the API accepts a `paymentMethod` field but the UI never sends one, so all expenses silently hit the cash ledger account even when paid by bKash/bank (EX-2).

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

## 9. Sales Section Feature Audit

This section audits the four Sales-section features (POS, Sales Invoice, Estimates, Payments) end-to-end (API + UI component). The core stock bug for the sale flow is already covered in Section 1, and the unsafe "add item to existing sale" flow is covered in Section 3 — those are NOT re-listed here.

Bug IDs are prefixed with the feature letter: **SL** (Sell/POS), **SI** (Sales Invoice), **E** (Estimates), **PM** (Payments).

### 9.1 Sell Products (POS)

**Files:** `src/modules/cctv-shop/components/CCTVSales.tsx` · `src/modules/cctv-shop/components/PaymentMethodSelector.tsx` · `src/modules/cctv-shop/components/QuickPartyDialog.tsx`

| ID | Severity | Bug |
|---|---|---|
| **SL-1** | High | POS loads products with `?limit=100` (line 103), but the API caps at 50 (`take: 50` in `products/route.ts` line 23). Products past row 50 can't be added to a cart via product-name search — the user types "HDD-4TB" and gets "No matching serial or product found" even though the product exists. |
| **SL-2** | High | Product-name search filters the cached (max 50) products client-side (lines 141–148). Serial-item search DOES hit the API (`/serial-items?search=...&status=IN_STOCK` line 128), so serial-search works regardless of cache. But the product-name branch silently misses anything past row 50. |
| **SL-3** | High | No atomic reservation of serial items. User adds serial S3 to cart on Terminal A; clerk on Terminal B adds S3 to cart on Terminal B; both carts look fine. Both submit; first succeeds, second gets "Serial S3 is not in stock or already sold" error from the backend atomic check. UX problem — clerk has already prepared the entire cart before discovering the conflict. |
| **SL-4** | Medium | Quantity input for non-serial items has `min="1"` HTML attribute (line 463) but no JS validation. User can type `0` or `-3` — `parseInt(e.target.value) \|\| 1` coerces `0` to `1` (because `0 \|\| 1 = 1` in JS) but accepts `-3` as `-3`. Backend doesn't validate `quantity > 0` either. Negative sale quantity would `increment` stock via the `decrement: -3` operation, letting a "sale" silently add inventory. |
| **SL-5** | Medium | UI doesn't check `quantity <= stock` before submit. User can add a non-serial product (stock=3), type qty=10, fill the rest of the cart, then click "Complete Sale" — gets an `Insufficient stock` error from the backend, but the cart state is already lost UX-wise. Should warn inline. |
| **SL-6** | Medium | No clamp on `invoiceDiscount`. UI computes `totalAmount = Math.max(0, subtotal - invoiceDiscount)` (line 219). If user types discount=৳5000 with subtotal=৳2000, total=৳0, "Due"=৳0. Sale goes through with `totalAmount=0` — a free sale. Backend also uses `Math.max(0, ...)` (sales/route.ts line 50), so this is consistent but probably unintended. |
| **SL-7** | Medium | No validation on `paidAmount`. UI accepts negative input (line 518 has `min="0"` HTML attribute but no JS guard). If user types `-100`, `parseFloat("-100") = -100`, the sale POST sends `paidAmount: -100`. Backend creates a `cCTVPayment` with `amount: -100` and a ledger entry DEBIT cash -100, CREDIT receivable -100. The "Less: cash -100" means cash on hand goes UP and receivable goes UP — both directions wrong. |
| **SL-8** | Low | After successful sale, POS navigates to `sale-invoice` view (line 253) but doesn't reset the cart, customer, or payment form state. If user clicks "back" from the invoice, the cart still has the sold items. Easy to accidentally re-submit. |
| **SL-9** | Low | POS doesn't display product stock in the cart. User adds product P (stock=3), increments qty to 10, sees no warning. The cart UI (lines 408–484) doesn't show available stock. |
| **SL-10** | Low | POS doesn't show the selected customer's previous due before completing the sale. The invoice GET endpoint computes `previousDue` (sales/[saleId]/route.ts lines 39–48), but it's only visible AFTER the sale is created. For credit customers, the POS should show "This customer already owes ৳X" before the user clicks Complete Sale. |

**Recommended fixes:**
- For **SL-1/SL-2**: Honor `?limit=` in `products/route.ts` (also Fixes P-1, P-3 from Section 8). Push product search to the server (`?search=` query).
- For **SL-3**: Add a "soft hold" API endpoint `POST /cctv/serial-items/[id]/hold` that marks a serial as `RESERVED` with a TTL (e.g. 10 minutes). POS calls this on add-to-cart. If hold expires, serial returns to `IN_STOCK`. Sale POST clears the hold. Alternative: just document that the POS isn't safe for concurrent clerks.
- For **SL-4**: Add JS guard: `if (parseInt(e.target.value) < 1) return;` and skip empty/zero values.
- For **SL-5**: Show inline warning in cart row when `item.quantity > product.stock`.
- For **SL-6**: Clamp `invoiceDiscount` to `[0, subtotal]` in both UI and API.
- For **SL-7**: Validate `paidAmount >= 0` in UI and API. Reject negative.
- For **SL-8**: Reset cart/customer/payment state in the `if (res.ok)` block of `handleSave` (line 248) before navigating.
- For **SL-10**: Fetch customer's outstanding due when selected; show as a small banner in the customer card.

### 9.2 Sales Invoice

**Files:** `src/app/api/businesses/[id]/cctv/sales/[saleId]/route.ts` · `src/modules/cctv-shop/components/CCTVSaleInvoice.tsx`

| ID | Severity | Bug |
|---|---|---|
| **SI-1** | High | `previousDue` is computed by summing ALL prior sales' `(totalAmount - paidAmount)` for that customer (route lines 39–48). This ignores standalone payments the customer made after those sales. If a customer has 3 sales (each ৳1000 due) and then paid ৳500 via the standalone `/payments` endpoint, the `previousDue` shown on the next invoice is still ৳3000, not ৳2500. The payment reduced the customer's receivable ledger balance but didn't update any specific sale's `paidAmount`. Result: invoice overstates previous due by the amount of unallocated payments. (Root cause is PM-1/PM-3 in §9.4.) |
| **SI-2** | High | "Sales Person: —" is hardcoded (UI line 209). Sale creation doesn't capture a salesperson. Field is dead on every invoice. |
| **SI-3** | Medium | Warranty display: `${item.warrantyMonths} ${item.warrantyMonths >= 12 ? 'Year' : 'Month'}` (line 283). 24 months prints as "24 Year", 36 months as "36 Year". Should divide: `>= 12 ? ${warrantyMonths/12} Year${warrantyMonths/12 > 1 ? 's' : ''}` or always show "X Month(s)". |
| **SI-4** | Medium | `totalQty.toFixed(2)` (line 285) — quantities are integers in the schema but the invoice prints "1.00", "5.00". Looks unprofessional for CCTV products sold in whole units. |
| **SI-5** | Medium | `numberToWords()` (lines 33–78) caps at 99 Crore. For ৳100,00,00,000+ the algorithm produces an empty string then `+ ' Only'`. Also: it doesn't handle `0` correctly when reached via the integer path (the `if (num === 0) return 'Zero'` short-circuits OK, but a ৳0.50 amount would print "and Fifty Paisa Only" with no Taka part — edge case). |
| **SI-6** | Medium | Grouping by `productId` (UI lines 240–256) loses per-item warranty info. `grouped[key].warrantyMonths` is initialized to `0` and never read from the actual items. So if a sale has 3 serials of a product, all with `warrantyMonths=12`, the invoice shows "—" for warranty on that row. |
| **SI-7** | Medium | VAT/AIT row hardcoded to `formatBDT(0)` (line 352). Bangladesh VAT invoices typically include Mushak 6.3 VAT. The mobile-shop module has full Mushak support; the CCTV invoice has no VAT field at all. If CCTV shops ever need to issue VAT-compliant invoices, this requires building out a VAT engine (which already exists in mobile-shop — could be ported). |
| **SI-8** | Low | The "Add VAT & AIT" row is always shown (line 351) even when the shop isn't VAT-registered. Should be conditional on business having a BIN. |
| **SI-9** | Low | "Prepared By: System" hardcoded (line 197). No user attribution on invoices. Multi-user shops can't tell which clerk created the sale. |
| **SI-10** | Low | Empty fill rows (lines 293–308) pad the table to 8 rows. If a sale has 12 line items, no fill rows; if 2, six fill rows. Cosmetic but inconsistent visual density. |

**Recommended fixes:**
- For **SI-1**: Depends on fixing PM-3 (link payments to sales). Once payments are linked, recompute `previousDue` as `Σ(totalAmount) − Σ(paymentsAllocatedToThoseSales)` instead of `Σ(totalAmount − saleInlinePaidAmount)`.
- For **SI-2 / SI-9**: Capture `userId` from session on sale POST; store as `salespersonId` on `cCTVSale`. Render on invoice.
- For **SI-3**: Replace with `${warrantyMonths >= 12 ? `${warrantyMonths/12} Year${warrantyMonths/12 > 1 ? 's' : ''}` : `${warrantyMonths} Month${warrantyMonths > 1 ? 's' : ''}`}`.
- For **SI-4**: Use `{item.totalQty}` (integer) instead of `{item.totalQty.toFixed(2)}` unless the unit is "meter" or "kg".
- For **SI-6**: When grouping, read `warrantyMonths` from the first item of that product group, not the literal `0`.
- For **SI-7**: Port the mobile-shop Mushak engine to CCTV, or at minimum expose a `vatEnabled` flag on the business and conditionally render the VAT row.

### 9.3 Estimates / Quotes

**Files:** `src/app/api/businesses/[id]/cctv/estimates/route.ts` · `src/app/api/businesses/[id]/cctv/estimates/[estimateId]/route.ts` · `src/app/api/businesses/[id]/cctv/estimates/[estimateId]/convert/route.ts` · `src/modules/cctv-shop/components/CCTVEstimates.tsx`

| ID | Severity | Bug |
|---|---|---|
| **E-1** | **Critical** | **Convert endpoint is NOT wrapped in `$transaction`.** Four separate writes happen sequentially (convert/route.ts lines 33–110): (1) create sale, (2) loop creating sale items + decrementing stock, (3) create payment if `paidAmount > 0`, (4) mark estimate as "converted". If step 3 or 4 fails, the sale is already created, items are created, stock is decremented, but the estimate is NOT marked converted → the user can re-click Convert → **duplicate sale + double stock decrement**. No rollback path. |
| **E-2** | High | Convert's stock decrement is wrapped in `try/catch {}` that silently swallows errors (lines 81–83). If `db.cCTVProduct.update` fails (e.g. Prisma connection error), the sale still goes through with stock NOT decremented. Also no `CCTVStockMovement` audit row is written. The Product Movement report will miss this sale's stock-out event. |
| **E-3** | High | Convert passes `item.productId \|\| "unknown"` to the new `CCTVSaleItem` (line 54). If an estimate item has no linked product (just a free-text line), the sale item's `productId` becomes the literal string `"unknown"` — not a valid product ID. Reports that group by `productId` (Purchase Report, Sales Report top products, Product Movement) will create an `"unknown"` bucket. The Sales Report `topProducts` aggregation keys by `productName` (line 67 of sales-report route), so this doesn't break the report, but the Product Movement report (which filters by `productId`) will silently drop these items. |
| **E-4** | High | Convert uses `cCTVSale.create` directly (line 33) instead of routing through the main sale POST flow (`sales/route.ts` POST). This skips: `CCTVStockMovement` audit row, `CCTVSerialHistory` entry (OK — estimates have no serials), ledger entries (DEBIT cash/receivable + CREDIT sales_revenue + DEBIT discount_given). **Convert creates a sale and a payment but writes ZERO ledger entries.** Books go out of balance every time an estimate is converted. P&L report under-counts revenue; balance sheet doesn't move cash or receivable. |
| **E-5** | High | Convert's stock check (line 71) is `if (product.stock < item.quantity)`. Non-atomic — read-then-write. Two concurrent converts of the same product can both pass the check and both decrement, driving stock negative. The main sale flow uses `updateMany` with `where: { stock: { gte: qty } }` which is atomic — convert should do the same. |
| **E-6** | High | Convert hardcodes `costPrice: 0` for all sale items (line 58). Comment says "estimates don't track cost". This means: P&L report shows revenue − 0 = 100% margin on every converted sale. COGS is understated, profit is overstated. Should fetch the product's current `costPrice` at convert time. |
| **E-7** | Medium | POST `/estimates` (lines 31–40) generates `estimateNo` as `EST-{YYMM}-{NNN}` based on a count of estimates this month. Race condition: two concurrent POSTs both see `count = N`, both generate `EST-2609-001`. No `@@unique([businessId, estimateNo])` constraint in the schema, so both insert successfully with duplicate numbers. |
| **E-8** | Medium | PATCH `/estimates/[id]` with `items` (lines 43–63) does `deleteMany` on existing items then creates new ones. **Not in a transaction.** If the create loop fails halfway (e.g. bad productName), the estimate is left with 0 items (or some items, depending on where it failed). |
| **E-9** | Medium | GET `/estimates` (line 17) caps at 100 with `take: 100` and no pagination. A business with 200+ estimates silently loses the oldest 100 from the list view. No way to page through. |
| **E-10** | Medium | Convert creates the sale with `saleDate: new Date()` (line 43) but doesn't allow the user to specify a sale date. An estimate approved on Sept 5 but converted on Sept 20 will have a Sept 20 sale date, skewing monthly reports. |
| **E-11** | Low | Estimate `status` accepts any string (`body.status \|\| "draft"` line 58 of POST). No enum validation in API or schema. Can set status to `"banana"`. UI enum is `draft | sent | approved | rejected | converted` but API doesn't enforce it. |
| **E-12** | Low | DELETE has a guard against converted (lines 86–88) — good. But there's no soft-delete. A draft estimate accidentally deleted is gone forever. No undo, no audit trail. |

**Recommended fixes:**
- For **E-1**: Wrap the entire convert flow in `db.$transaction(async (tx) => { ... })`. Use `tx` for every write inside.
- For **E-2**: Inside the transaction, use the atomic `updateMany` pattern from the main sale flow (sales/route.ts lines 152–158): `updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })`. Check `updated.count === 0` for insufficient stock. Don't swallow the error — throw, so the transaction rolls back. Also write a `CCTVStockMovement` row.
- For **E-3**: Either reject convert if any item has no `productId`, or fall back to a placeholder behavior (skip stock decrement but record the item with `productId: null` — schema allows it).
- For **E-4**: Either (a) call the existing sale POST logic as a function (refactor `sales/route.ts` POST into a callable helper), or (b) duplicate the ledger + stock-movement logic into convert. Option (a) is preferred to avoid drift.
- For **E-5**: Same as E-2 — use `updateMany` with `stock: { gte: qty }`.
- For **E-6**: Fetch `costPrice` from the product at convert time: `const product = await tx.cCTVProduct.findUnique({ where: { id: item.productId }, select: { costPrice: true } }); ... costPrice: product?.costPrice ?? 0`.
- For **E-7**: Add `@@unique([businessId, estimateNo])` to the schema + new migration. Handle P2002 in POST by retrying with N+1.
- For **E-8**: Wrap PATCH-with-items in a transaction.
- For **E-9**: Add `pagination: { page, pageSize, total, totalPages }` to GET response, same shape as `purchases/route.ts`.
- For **E-10**: Accept `saleDate` in the convert request body, default to `new Date()` if not provided.
- For **E-11**: Validate `status` against an enum in POST and PATCH.

### 9.4 Payments

**Files:** `src/app/api/businesses/[id]/cctv/payments/route.ts` · `src/lib/ledger-helper.ts` · `src/modules/cctv-shop/components/PaymentMethodSelector.tsx`

| ID | Severity | Bug |
|---|---|---|
| **PM-1** | **Critical** | **Standalone payments don't enforce linkage to a sale/purchase.** The `referenceId` field is optional — a customer payment recorded via `/payments` POST with just `customerId` (no `referenceId`) creates a payment that "floats" with no sale to credit. Customer ledger balance goes down, but no individual sale's `dueAmount` changes. When `sales/[saleId]` GET computes `previousDue` (route lines 39–48), it sums `totalAmount − paidAmount` per sale — the floating payment isn't credited to any sale, so previousDue is overstated by the unallocated amount. |
| **PM-2** | High | Payment `type` rewriting breaks the GET filter. POST accepts `customer_discount` / `supplier_discount` (lines 55–64) but stores them as `customer_payment` / `supplier_payment` with `[DISCOUNT]` prefix in notes. The GET endpoint (line 18) filters by `type` directly. `GET /payments?type=customer_discount` returns zero rows — the type was rewritten on write. There's no way to query discount payments specifically. |
| **PM-3** | High | **Payment doesn't update the linked sale's `paidAmount` / `dueAmount` fields.** When a customer pays ৳1000 against sale S1 (which had `paidAmount=0, dueAmount=1000`), the `/payments` POST creates a `cCTVPayment` row and ledger entries (customer receivable ↓, cash ↑), but **never updates `cCTVSale.paidAmount` or `cCTVSale.dueAmount`**. The sale's record still shows "Due ৳1000" forever. The Customer Ledger report (which aggregates from sales + payments) shows the correct balance, but the Sales History list view shows each sale as still due. Inconsistent — operator sees "Due ৳1000" on the sale but "Customer balance ৳0" on the ledger. |
| **PM-4** | High | `paymentMethod` is free-text — schema stores any string. If user passes `paymentMethod: "monkey"`, it's stored verbatim. `paymentMethodToAccount()` in `ledger-helper.ts` (lines 77–85) silently falls back to `LEDGER_ACCOUNTS.CASH` for unknown methods. A "monkey" payment gets recorded as cash on the books but as "monkey" in the payment record — silent misclassification. |
| **PM-5** | Medium | Discount handling is inconsistent. POST stores `type: "customer_payment"` + `notes: "[DISCOUNT] ..."` for a customer discount (lines 58–60). The customer ledger UI must parse the `[DISCOUNT]` prefix from notes to render a discount differently from a regular payment — fragile. Better: keep `type = "customer_discount"` in the DB (the schema allows any string) and let the UI filter on it. |
| **PM-6** | Medium | GET `/payments` (lines 26–33) returns payment rows without joining the customer or supplier. UI must do N+1 fetches to display customer names in a payments list. Should `include: { customer: { select: { name: true } }, supplier: { select: { name: true } } }`. |
| **PM-7** | Medium | `PaymentMethodSelector` exposes only 4 methods (cash, bank, bkash, nagad). No "card", no "cheque", no "due/credit" option. Bangladesh CCTV shops sometimes take card payments via POS terminals — there's no way to record those. May be intentional for the MVP but worth flagging. |
| **PM-8** | Medium | Payments don't support partial allocation. A customer paying ৳5000 against two outstanding sales (৳3000 + ৳2000) — there's no API to allocate ৳3000 to sale A and ৳2000 to sale B. The `referenceId` field only takes one sale ID. Either the payment is "unallocated" (PM-1) or fully credited to one sale, leaving the other fully due. |
| **PM-9** | Low | The `[DISCOUNT]` notes prefix is parsed by string matching. If a user types `"[DISCOUNT] Customer gave us 10% off for bulk buy"` in notes via a future API that doesn't set the prefix, the discount logic silently won't trigger. Should be a separate boolean column `isDiscount`. |
| **PM-10** | Low | POST `/payments` doesn't return the updated ledger balance or the new customer/supplier balance. UI must do a separate GET to refresh the ledger view. |

**Recommended fixes:**
- For **PM-1**: Either (a) require `referenceId` for any payment with `type = customer_payment/supplier_payment` (reject if missing), or (b) implement a payment-allocation model: a `CCTVPaymentAllocation` join table linking payments to sales with amounts. Option (b) is the proper accounting solution. Option (a) is the MVP workaround.
- For **PM-2**: Keep `type` as the original value (`customer_discount` etc.) in the DB. Either add a separate `kind: "regular" \| "discount"` column, or just trust the original `type` value. Update GET filter to pass through.
- For **PM-3**: After creating the payment, if `referenceId` is set AND `type === "sale"`, atomically update the linked sale:
  ```ts
  await tx.cCTVSale.update({
    where: { id: body.referenceId },
    data: {
      paidAmount: { increment: amount },
      dueAmount: { decrement: amount },
      paymentType: <recompute based on new dueAmount>,
    },
  });
  ```
  Wrap in the existing transaction. Same logic for purchases. If `referenceId` is null, leave the payment unallocated (and surface it in a "unallocated payments" report).
- For **PM-4**: Validate `paymentMethod` against the `PAYMENT_METHODS` enum from `PaymentMethodSelector.tsx` in the API. Reject unknown values.
- For **PM-5**: Add `isDiscount: Boolean @default(false)` column. Use it instead of parsing notes.
- For **PM-6**: Add `include` to GET for customer/supplier names.
- For **PM-8**: Build a `CCTVPaymentAllocation` model (paymentId, saleId, amount). One payment → many allocations. Document the FIFO or manual allocation strategy.

### 9.5 Priority summary across the Sales section

| Priority | Bug IDs | What to fix first |
|---|---|---|
| **P0** (blocks normal use) | E-1, E-4 | Wrap convert in transaction; create ledger entries in convert |
| **P1** (data correctness) | PM-1, PM-3, E-2, E-3, E-5, E-6, SI-1, SL-1, SL-2 | Link payments to sales (and update sale's paidAmount), atomic stock decrement in convert, drop "unknown" productId, fetch real costPrice in convert, fix previousDue math, fix POS product limit |
| **P2** (UX / consistency) | SL-3, SL-4, SL-5, SL-6, SL-7, SI-2, SI-3, SI-4, SI-6, E-7, E-8, E-9, E-10, PM-2, PM-4, PM-5, PM-6, PM-7, PM-8 | Serial reservation, quantity validation, paidAmount validation, salesperson capture, warranty formatting, qty formatting, warranty grouping, estimate number uniqueness, PATCH transaction, pagination, saleDate on convert, type rewriting, paymentMethod enum, discount flag, GET includes, payment allocation |
| **P3** (polish) | SL-8, SL-9, SL-10, SI-5, SI-7, SI-8, SI-9, SI-10, E-11, E-12, PM-9, PM-10 | State reset, stock display in cart, customer due banner, numberToWords edge cases, VAT row conditional, empty fill rows, salesperson name, status enum validation, soft delete, discount notes parsing, return balance |

### 9.6 Files to touch for Section 9 fixes

| File | Fix IDs |
|---|---|
| `src/modules/cctv-shop/components/CCTVSales.tsx` | SL-1, SL-3, SL-4, SL-5, SL-6, SL-7, SL-8, SL-9, SL-10 |
| `src/app/api/businesses/[id]/cctv/products/route.ts` | SL-1, SL-2 (shared with P-1, P-3) |
| `src/app/api/businesses/[id]/cctv/sales/[saleId]/route.ts` | SI-1 (depends on PM-3 fix) |
| `src/modules/cctv-shop/components/CCTVSaleInvoice.tsx` | SI-2, SI-3, SI-4, SI-5, SI-6, SI-7, SI-8, SI-9, SI-10 |
| `src/app/api/businesses/[id]/cctv/estimates/route.ts` | E-7, E-9, E-11 |
| `src/app/api/businesses/[id]/cctv/estimates/[estimateId]/route.ts` | E-8, E-11, E-12 |
| `src/app/api/businesses/[id]/cctv/estimates/[estimateId]/convert/route.ts` | E-1, E-2, E-3, E-4, E-5, E-6, E-10 |
| `src/modules/cctv-shop/components/CCTVEstimates.tsx` | (UI changes follow API contract) |
| `prisma/schema.prisma` + new migration | E-7 (`@@unique([businessId, estimateNo])`), PM-5 (`isDiscount` column), PM-8 (`CCTVPaymentAllocation` model) |
| `src/app/api/businesses/[id]/cctv/payments/route.ts` | PM-1, PM-2, PM-3, PM-4, PM-6, PM-10 |
| `src/lib/ledger-helper.ts` | PM-4 (validate method) |
| `src/modules/cctv-shop/components/PaymentMethodSelector.tsx` | PM-7 |
| `src/modules/cctv-shop/components/QuickPartyDialog.tsx` | (no bugs found — clean) |

---

## 10. Repairs & Service Feature Audit

This section audits the three Repairs & Service features (Repairs, Repair Token, Warranty Dashboard) end-to-end (API + UI).

Bug IDs are prefixed: **RP** (Repairs), **RT** (Repair Token), **W** (Warranty Dashboard).

The `CCTVRepair` model is at `prisma/schema.prisma` and the relevant API routes are `src/app/api/businesses/[id]/cctv/repairs/route.ts` (POST = receive), `src/app/api/businesses/[id]/cctv/repairs/[repairId]/route.ts` (GET / PATCH), and `src/app/api/businesses/[id]/cctv/warranties/route.ts` (warranty dashboard GET).

### 10.1 Repairs — POST /repairs (receive)

**Files:** `src/app/api/businesses/[id]/cctv/repairs/route.ts` · `src/modules/cctv-shop/components/CCTVRepairs.tsx`

| ID | Severity | Bug |
|---|---|---|
| **RP-1** | **Critical** | **No status check on the serial item before transitioning to `IN_REPAIR`.** POST line 39–42 looks up the serial item by `serialNumber` only — it does NOT filter by `status: "SOLD"` or exclude `IN_REPAIR`. If a serial is already `IN_REPAIR` (an open repair exists), another receive will find the same serial and overwrite its status to `IN_REPAIR` again. This means: (a) the same serial can be in two open repairs at once, (b) a serial that's `RETURNED_TO_CUSTOMER` can be "received for repair" again, (c) a serial that's `SENT_TO_SUPPLIER` can be received for repair while still in transit. Should require `status: "SOLD"` (or `"RETURNED_TO_CUSTOMER"` if you allow re-repairs) and reject otherwise. |
| **RP-2** | High | POST creates a `CCTVCustomer` if `customerPhone` is provided and not found (lines 60–69). Schema requires `phone` to be non-null on `CCTVCustomer`, but the lookup uses `phone` only. If `customerName` is provided but `customerPhone` is empty, no customer is created and `customerId` stays null — so a named customer on the repair isn't linked to the customer master. The customer ledger later won't show this repair's history. |
| **RP-3** | High | PATCH has **no state-machine validation** (lines 52–69). Accepts any `body.status` string and applies it. You can move `received → returned` directly (skipping `in_repair` and `ready`), or move a `returned` repair back to `received` (reviving a closed job). Worse: if you transition `returned → received`, the serial's status goes from `RETURNED_TO_CUSTOMER` back to `IN_REPAIR` (line 123) — fine for a re-repair scenario — but the repair's `returnedDate` stays populated (line 67 condition `if (!repair.returnedDate)` is false), so the new receive date isn't recorded. Status machine should be enforced. |
| **RP-4** | **Critical** | PATCH sets the serial to `IN_STOCK` on `ready` (line 124). A serial that's been received for repair is still owned by the customer — it's NOT in the shop's sellable inventory. By marking it `IN_STOCK`, the Stock Report (which counts `IN_STOCK` serials) inflates by 1, and the sale POS can find this serial via `?status=IN_STOCK` and add it to a cart → **the shop can sell a customer's property**. Should add a new status `READY_FOR_PICKUP` or keep `IN_REPAIR` and surface it as "Ready" in the UI. |
| **RP-5** | High | POST does not validate `receivedDate` is not in the future. User can back-date or forward-date the repair. A future-dated repair shows up in "today's repairs" today; a back-dated repair skews monthly stats. `body.receivedDate ? new Date(body.receivedDate) : new Date()` (line 107) accepts any date. |
| **RP-6** | Medium | Token number generation race condition (lines 79–89). `todayCount = COUNT(receivedDate in [startOfDay, endOfDay])`, then `tokenNo = R{yy}{mm}{dd}{NN}`. Two concurrent POSTs both see `count = N`, both generate the same token number. Schema has `@unique` on `tokenNo`, so the second one throws P2002 — surfaced as generic "Failed to create repair". Should retry with N+1, or use a sequence table. |
| **RP-7** | High | `repairCost` is stored but never invoiced. PATCH accepts `repairCost` (line 58) and stores it on the repair record. UI shows it on the detail view (lines 379–384 of CCTVRepairs.tsx) and on the repair token (CCTVRepairToken.tsx line 206–212). **But there is no sale or payment created, no ledger entry written, no customer receivable increased.** A ৳500 repair charge is invisible to the P&L, the Customer Ledger, and the Cash Book. The shop is doing free repairs on the books even when the customer paid cash. |
| **RP-8** | Medium | GET `/repairs` (route.ts line 17) caps at 100 with `take: 100` and no pagination metadata. Same shape problem as `estimates` (E-9) and `products` (P-1). A shop with 200+ repairs silently loses the oldest 100. |
| **RP-9** | Medium | PATCH does not enforce that `serialItemId` is set before updating the serial status (line 130). If a repair was created with a free-text serial (no matching `CCTVSerialItem` row), `repair.serialItemId` is null. The `updateMany({ where: { id: repair.serialItemId } })` then runs `updateMany({ where: { id: null } })` which updates 0 rows silently — fine in this case, but the code should guard explicitly. |
| **RP-10** | Medium | No DELETE endpoint. A repair created in error cannot be deleted — only "closed". Once a token number is generated, it's permanently in the audit trail. No soft-delete either. Not necessarily a bug — audit integrity matters — but it should be a deliberate design decision, documented. |
| **RP-11** | Low | `underWarranty` is a snapshot at receive time (line 105 + 106). If the warranty expires during the repair, the snapshot stays `true`. UI shows "Under Warranty" forever, even after warranty expired. Should re-evaluate on PATCH to `returned` (charge post-warranty if it expired during the repair). |
| **RP-12** | Low | PATCH with the same status as current (`newStatus === previousStatus`) skips all serial update + history logic (line 80 condition `if (newStatus !== previousStatus)`). Updating `repairCost` alone — common scenario: "tech added cost after starting" — won't write a history entry. Only status changes are audited. |
| **RP-13** | Low | UI "Open" filter (line 258 of CCTVRepairs.tsx) treats `replaced` as closed, but the API doesn't — `replaced` is a terminal status. Fine, but the open/closed split should live in the API as a query param, not just the client. Currently the API doesn't expose `?filter=open|closed`. |
| **RP-14** | Low | No notes/history entry on cost-only update. If the tech updates `repairCost` from ৳500 to ৳700 without changing status, no audit trail. |

### 10.2 Repair Token

**Files:** `src/modules/cctv-shop/components/CCTVRepairToken.tsx`

| ID | Severity | Bug |
|---|---|---|
| **RT-1** | High | Token uses `repair.status` directly (line 204), printed at receive time as "received" — but the token is re-printable later. If the user prints the token after the status has moved to `in_repair`, the printed token says "IN REPAIR", which is confusing to the customer who already has the original "received" token. Should print the status at receive time, not current status. |
| **RT-2** | High | "Out of Warranty — PAID" hardcoded (line 142) regardless of whether the shop actually charges for out-of-warranty repairs. Some shops do free out-of-warranty repairs too. Combined with RP-7 (no payment flow), the "PAID" label is also factually wrong — no payment was collected. |
| **RT-3** | Medium | Token doesn't include the estimated completion date. Customer walks away with a token but no idea when to come back. The schema doesn't have an `estimatedReadyDate` field either. |
| **RT-4** | Medium | `repairCost` is shown on the token if > 0 (lines 206–212), but as noted in RP-7, `repairCost` is recorded by the tech AFTER the customer drops off the product. At intake, the cost is unknown. So the printed token either shows the cost the tech happened to enter before printing, or hides it. Confusing. |
| **RT-5** | Low | No barcode/QR code on the token. The token number is a plain string. A scanner can't read it back when the customer returns — the shop must type the token number to look up the repair. Adding a QR encoding the token number would speed up pickup. |
| **RT-6** | Low | Token prints all on one page with no cut-line guidance. The dashed border at the bottom (lines 216–228) says "Cut along the dashed line" in the helper text (line 233) but the actual cut line is the same border as the rest. Should have an explicit `border-t-2 border-dashed` between the "token" portion and the "claim instructions" portion to indicate where to cut. |
| **RT-7** | Low | No shop logo on the token (uses a hardcoded `Camera` icon, line 111). The business likely has a `logo` field on the Business model — should use it if present. |
| **RT-8** | Low | Token doesn't show the shop's BIN/TIN — relevant for Bangladesh if the shop is VAT-registered. (Echoes SI-7 from Section 9.) |

### 10.3 Warranty Dashboard

**Files:** `src/app/api/businesses/[id]/cctv/warranties/route.ts` · `src/modules/cctv-shop/components/CCTVWarrantyDashboard.tsx`

| ID | Severity | Bug |
|---|---|---|
| **W-1** | **Critical** | **`RETURNED_TO_CUSTOMER` items are included in the warranty list and stats.** API line 22: `status: { in: ["SOLD", "IN_REPAIR", "SENT_TO_SUPPLIER", "RETURNED_TO_CUSTOMER"] }`. A serial that was returned to the customer after a previous repair is still being tracked here — its warranty end date is the original sale date + warranty months. The active/expiring/expired buckets are computed on `warrantyEnd` regardless of status (lines 33–35). So a returned serial with an active warranty shows in the "Active" count, even though it's already been returned to the customer and is none of the shop's concern. The dashboard should filter to `["SOLD", "IN_REPAIR", "SENT_TO_SUPPLIER"]` only. |
| **W-2** | High | "Expiring" count is computed from the "active" set (line 34), so it's correct relative to active — but the UI badge (CCTVWarrantyDashboard.tsx line 289–296) recomputes "expiring" as `days >= 0 && days <= 30`, which double-counts items that are already counted in "active". The four stats cards (lines 141–176) sum to more than `total` if you add `active + expiring + expired` — because `expiring` is a subset of `active`, not a separate bucket. Misleading. Either rename the card to "Expiring Soon (subset of Active)" or make it a separate bucket. |
| **W-3** | High | Warranty Dashboard does NOT include repairs in the warranty counts. A serial in `IN_REPAIR` status is in `allSerials` (line 22 includes it), so its warranty is tracked. But the "Repairs In Progress" count (line 38–45) is a separate query against `cctv_repairs` filtered by status. The two sources can disagree: a serial `SOLD` with active warranty, but a `received` repair with `underWarranty=false` (e.g. warranty already expired when received). The UI shows the repair count under a separate stat but doesn't reconcile. |
| **W-4** | High | No pagination on serials. `allSerials` returns every warranty-tracked serial with no `take:`. A shop that's sold 5,000 cameras has 5,000 rows in the response. UI renders them all (CCTVWarrantyDashboard.tsx line 286 `filteredSerials.map`). Browser memory + render time hit. Should paginate. |
| **W-5** | Medium | The filter query param `?filter=active|expiring|expired` is applied to the serials list (lines 49–55), but the **stats are computed from `allSerials` regardless of filter**. So if a user clicks the "Expired" filter pill, the stats cards still show active/expiring/repair counts. Confusing — either hide the cards when filtered, or note that stats reflect all items. |
| **W-6** | Medium | UI search (lines 114–121) filters the client-side serials list by `serialNumber`, `product.name`, `product.brand`, `customerName`. Doesn't search by `customerPhone`. A shop trying to find a warranty item by customer phone can't. |
| **W-7** | Medium | UI "Receive for Repair" button (lines 348–359) navigates to the `repairs` view without any context — it just lands on the repairs list. The user has to manually open the New Repair form and type the serial number again. Should pass the serial number as context: `navigate('repairs', { serialNumber: s.serialNumber })` or add a query param. |
| **W-8** | Medium | The "Expiring Soon" badge on a serial (lines 334–336) shows `{days}d left`. But if the warranty end is in the past, `daysUntil()` returns a negative number and the expired branch takes precedence (line 330). However, `daysUntil` uses `Math.ceil` (line 83) which gives `0` for "expires today in less than 24h" — and the UI then shows "0d left" in the active branch (line 340) which is misleading (the warranty is effectively expired). Should use `Math.floor` for "days left" semantics. |
| **W-9** | Low | The dashboard doesn't show warranty _claims_ — only repairs in progress. A serial could have had 3 prior repairs under warranty and the dashboard gives no hint. The history is in `cctv_serial_history`, not surfaced. |
| **W-10** | Low | No "expiring this month" or "expiring this week" granularity — just a single 30-day window. Some shops want a 7-day alert for proactive service calls. |
| **W-11** | Low | The "Warranty Tracked Items" header (line 233) shows the total count via the filter pills (line 246) but the actual count shown is `data.stats.total` — which includes `RETURNED_TO_CUSTOMER` per W-1. Inflated. |
| **W-12** | Low | No CSV export. A shop with 200 warranties and 30 expiring this month has no way to export the "expiring" list for proactive calling. |

### 10.4 Recommended fixes (prioritized)

#### P0 — blocks normal use

- **RP-1**: In `repairs/route.ts` POST, change the serial lookup (line 39) to also filter by `status: "SOLD"`. Reject with a 400 if the serial is `IN_REPAIR`, `SENT_TO_SUPPLIER`, `RETURNED_TO_CUSTOMER`, or `REPLACED`:
  ```ts
  const serialItem = await tx.cCTVSerialItem.findFirst({
    where: { businessId, serialNumber: body.serialNumber, status: "SOLD" },
  });
  // If not found, fall back to RETURNED_TO_CUSTOMER (re-repair scenario) with a warning.
  ```
- **RP-4**: In `repairs/[repairId]/route.ts` PATCH line 124, do NOT set serial to `IN_STOCK` on `ready`. Either keep it `IN_REPAIR` and surface the "ready" state via the repair's status, or add a new `READY_FOR_PICKUP` status. Update the Stock Report's IN_STOCK count override accordingly.
- **W-1**: In `warranties/route.ts` line 22, change `status: { in: [...] }` to remove `RETURNED_TO_CUSTOMER`:
  ```ts
  status: { in: ["SOLD", "IN_REPAIR", "SENT_TO_SUPPLIER"] }
  ```

#### P1 — data correctness

- **RP-3**: Add an allowed-transitions map in PATCH:
  ```ts
  const ALLOWED: Record<string, string[]> = {
    received: ["in_repair", "sent_to_supplier", "closed"],
    in_repair: ["ready", "sent_to_supplier", "closed"],
    ready: ["returned", "closed"],
    sent_to_supplier: ["replaced", "closed"],
    replaced: ["closed"],
    returned: [],
    closed: [],
  };
  if (!ALLOWED[previousStatus]?.includes(newStatus)) {
    return NextResponse.json({ error: `Cannot transition ${previousStatus} → ${newStatus}` }, { status: 400 });
  }
  ```
- **RP-7**: Build a repair-invoice flow. Either (a) create a `CCTVSale` with `paymentType: "repair"` and a single sale item referencing the repair, or (b) add a `repairInvoiceId` column on `CCTVRepair` and create the invoice + ledger entries on PATCH to `returned`. Either way, the repair cost must hit the ledger (DEBIT cash/receivable, CREDIT service_revenue).
- **RP-2**: If `customerName` is provided but no `customerPhone`, either require phone, or look up customer by name within the business. Don't silently drop the link.
- **RT-2**: Make the warranty banner configurable. Add a `repairChargePolicy` field on the business (`free_under_warranty | charge_out_of_warranty | always_free | always_charge`). Drive the token text from that.

#### P2 — UX / consistency

- **RP-6**: Handle P2002 on `tokenNo` with a retry loop (up to 3 times).
- **RP-8**: Add pagination to GET `/repairs` (same shape as `purchases/route.ts`).
- **W-2**: Rename the "Expiring Soon" stat card to "Expiring Soon (active, ≤30 days)" or split into mutually exclusive buckets.
- **W-4**: Paginate the warranties endpoint. UI can use "Load more".
- **W-5**: Either freeze stats when a filter is applied, or note "Showing X of Y" near the cards.
- **W-7**: Pass serial context when navigating to repairs:
  ```ts
  navigate('repairs', { serialNumber: s.serialNumber })
  ```
  And in CCTVRepairs.tsx, pre-fill the serialNumber form field if `contextId` is an object with a serialNumber.

#### P3 — polish

- **RP-5**, **RP-9**, **RP-10**, **RP-11**, **RP-12**, **RP-13**, **RP-14**: validation hardening, soft delete, warranty re-eval, cost-update audit.
- **RT-3**, **RT-4**, **RT-5**, **RT-6**, **RT-7**, **RT-8**: estimated ready date, conditional cost display, QR code, cut line, logo, BIN.
- **W-6**, **W-8**, **W-9**, **W-10**, **W-11**, **W-12**: phone search, days-left floor, repair history, configurable window, accurate total, CSV export.

### 10.5 Files to touch for Section 10 fixes

| File | Fix IDs |
|---|---|
| `src/app/api/businesses/[id]/cctv/repairs/route.ts` | RP-1, RP-2, RP-5, RP-6, RP-8 |
| `src/app/api/businesses/[id]/cctv/repairs/[repairId]/route.ts` | RP-3, RP-4, RP-7, RP-9, RP-11, RP-12, RP-13, RP-14 |
| `src/app/api/businesses/[id]/cctv/warranties/route.ts` | W-1, W-3, W-4, W-5, W-11 |
| `src/modules/cctv-shop/components/CCTVRepairs.tsx` | RP-13, W-7 |
| `src/modules/cctv-shop/components/CCTVRepairToken.tsx` | RT-1, RT-2, RT-3, RT-4, RT-5, RT-6, RT-7, RT-8 |
| `src/modules/cctv-shop/components/CCTVWarrantyDashboard.tsx` | W-2, W-6, W-7, W-8, W-9, W-10, W-12 |
| `prisma/schema.prisma` + new migration | RP-7 (`repairInvoiceId`), RT-3 (`estimatedReadyDate`), RT-2 (`repairChargePolicy` on `Business`), RP-4 (new `READY_FOR_PICKUP` status if chosen) |

---

## 11. Customers & Expenses Feature Audit

This section audits the three Customers & Expenses features (Customer Ledger, Due Collection, Expenses) end-to-end (API + UI). The Payment flow that the Customer Ledger invokes is covered in Section 9.4 — those bugs are NOT re-listed here, but their impact on the ledger is called out where relevant.

Bug IDs are prefixed: **CL** (Customer Ledger), **CU** (Customers CRUD), **DC** (Due Collection), **EX** (Expenses).

### 11.1 Customer Ledger

**Files:** `src/app/api/businesses/[id]/cctv/reports/customer-ledger/route.ts` · `src/app/api/businesses/[id]/cctv/customers/route.ts` · `src/modules/cctv-shop/components/CCTVLedger.tsx`

| ID | Severity | Bug |
|---|---|---|
| **CL-1** | **Critical** | **The "Returns" query is broken and silently returns nothing.** Route lines 105–109 do `db.cCTVReturn.findMany({ where: { businessId }, include: { items: { where: { productId: { in: sales.flatMap(s => [s.id]) } } } } })`. Two bugs in one: (a) `sales.flatMap(s => [s.id])` produces an array of sale IDs, but the filter is `items.productId IN [sale.id]` — `productId` is a product ID, not a sale ID, so this never matches; (b) the result is never appended to the `entries` array even if it did match. So returns are silently invisible in every customer ledger. (Also note: there is no `/api/businesses/[id]/cctv/returns/` endpoint — only a shared `/businesses/[id]/returns/` — so CCTV returns can't actually be created from the CCTV module anyway.) |
| **CL-2** | **Critical** | **The customer-list endpoint (no `customerId`) ignores standalone payments entirely.** Route lines 20–31 compute each customer's balance as `openingBalance + Σ(sale.totalAmount) − Σ(sale.paidAmount)`. This uses the per-sale `paidAmount` column, which is NOT updated by standalone `/payments` POSTs (see PM-3 in §9.4). The per-customer detail endpoint (lines 88–103) DOES include payments separately. Result: the customer-list balance diverges from the per-customer ledger balance whenever a standalone payment is recorded. Operator sees one number on the list, a different number on the detail. |
| **CL-3** | High | Both balance computations (CL-2 + per-customer ledger) **ignore repair charges** entirely. Per RP-7 (§10.1), `repairCost` is never invoiced and never creates a sale or ledger entry. So a customer who had ৳5000 of repairs shows ৳0 in the ledger, even though the shop did ৳5000 of work for them. Combined with RP-7, the ledger is silently missing an entire revenue stream. |
| **CL-4** | High | No pagination on the customer list (lines 13–17). A business with 5,000 customers loads all of them in one response. Worse, lines 20–31 do an N+1 query: for each customer, a separate `cCTVSale.findMany` query. 5,000 customers = 5,001 queries. Should use a single aggregation query with `_sum` and `groupBy`. |
| **CL-5** | High | Per-customer ledger has no date filter. `sales.findMany({ where: { businessId, customerId } })` and `payments.findMany({ where: { businessId, customerId } })` return every transaction since the beginning of time. For a customer with 10 years of history, that's thousands of rows. No `?from=&to=` query param. |
| **CL-6** | High | Ledger entries are sorted by date string only (line 112: `entries.sort((a, b) => a.date.localeCompare(b.date))`). Two entries on the same date — a sale in the morning and a payment in the afternoon — sort by date string ("2026-09-08" === "2026-09-08") and preserve their insertion order (sales first, then payments). But for a customer who paid on the same day they bought, the ledger shows `Sale (debit 5000) → balance 5000` then `Payment (credit 5000) → balance 0`. The balance progression is correct, but the order within a day is arbitrary. Should sort by date + type (sales before payments) or by a real timestamp. |
| **CL-7** | Medium | Opening balance is added as a single entry on `customer.createdAt` (lines 57–66). If the customer was created in 2024 but the operator is viewing the ledger for 2026, the opening balance entry is from 2024 — outside the visible window if a date filter is added. The opening balance should be carried forward as the starting balance for any date range, not as a dated entry. |
| **CL-8** | Medium | The "Receive Payment" / "Discount" buttons (UI lines 311–356) call `/payments` POST without a `referenceId`. This is the PM-1 root cause from §9.4 — the payment floats, no sale is credited. Combined with CL-2, the customer-list balance will diverge from the per-customer ledger. The fix should land in `/payments` (require or allocate `referenceId`), but the CCTVLedger UI also needs to surface the unallocated choice. |
| **CL-9** | Medium | UI party selector (lines 211–223) is a `<select>` dropdown with one option per customer. A shop with 1,000 customers has a 1,000-option dropdown. No search, no infinite scroll. Unusable. Should be a searchable combobox (the `QuickPartyDialog` already implements this pattern for the POS). |
| **CL-10** | Medium | UI ledger table (lines 360–397) renders all entries with no virtualization. A 1,000-entry ledger renders 1,000 rows in the DOM. Browser memory + scroll perf hit. |
| **CL-11** | Medium | No CSV/Excel export. Accountants want a printable ledger per customer for a date range. UI has a Print button (line 188) but no export. |
| **CL-12** | Low | UI summary card "Total They Owe" (line 289) shows `totalDebit - totalCredit` — which equals `balance` (line 135 of route). But the "Current Balance" card (line 292) also shows `balance`. Two cards showing the same number is redundant. |
| **CL-13** | Low | The "Discount / Adjust" flow (UI lines 332–341) sets `paymentMethod: 'cash'` hardcoded (line 133 of CCTVLedger.tsx) because discounts are "always cash adjustments". But the ledger entry created is `DEBIT discount_given, CREDIT customer_receivable` (per PM-5 in §9.4) — no cash account is touched. So the `paymentMethod` field is misleading; it's recorded but unused. Should be omitted from the request body for discount mode. |
| **CL-14** | Low | "Quick Pay" buttons (UI lines 346–355) set the payment amount to 25%/50%/75%/100% of the balance. But the payment POST sends `amount: paymentAmount` as a string (line 132 of UI). The API does `parseFloat(body.amount)` (line 74 of payments route). A ৳1000 balance at 25% = "250" string → parseFloat → 250. Works, but the type should be number not string. |
| **CL-15** | Low | No "void payment" or "reverse entry" flow. A payment recorded in error can't be undone — only offset with another entry. Should support soft-delete with a reversing ledger entry. |

**Recommended fixes:**
- For **CL-1**: Either delete the broken returns query (if returns aren't a feature yet) or fix it: filter by `saleId IN sales.map(s => s.id)`, and actually push the returns into `entries` as credit entries. Also build a `/api/businesses/[id]/cctv/returns/` endpoint so returns can be created from the CCTV module.
- For **CL-2**: Compute the customer-list balance the same way the per-customer ledger does — include payments. Or, better, fix PM-3 so payments update `sale.paidAmount`, and CL-2 becomes correct automatically.
- For **CL-3**: Depends on RP-7. Once repair charges create sales or ledger entries, they'll flow into the ledger naturally.
- For **CL-4**: Replace the N+1 with a single aggregation:
  ```ts
  const balances = await db.cCTVSale.groupBy({
    by: ["customerId"],
    where: { businessId },
    _sum: { totalAmount: true, paidAmount: true },
  });
  ```
- For **CL-5**: Add `?from=&to=` query params. Filter both `sales` and `payments` by date. Carry opening balance as the starting balance for the range.
- For **CL-6**: Sort by `[date, type priority]` or by a real timestamp if available.
- For **CL-9**: Replace the `<select>` with the existing `QuickPartyDialog` in "select" mode, or a `Combobox` from shadcn/ui.

### 11.2 Customers (CRUD)

**Files:** `src/app/api/businesses/[id]/cctv/customers/route.ts` · `src/modules/cctv-shop/components/QuickPartyDialog.tsx`

> **⚠️ There is no `src/app/api/businesses/[id]/cctv/customers/[customerId]/route.ts` file at all.** Same gap as F-1 for products (§8.2). Customers can be created via POST and listed via GET, but cannot be edited or deleted.

| ID | Severity | Bug |
|---|---|---|
| **CU-1** | **Critical** | **No edit or delete customer endpoint exists.** Once a customer is created, name/phone/address/openingBalance cannot be modified. A typo in the phone number at create time is permanent. There is no soft-delete either, so a duplicate or test customer clutters the ledger forever. |
| **CU-2** | High | GET `/customers` (lines 7–12) returns customers directly as a bare array (`NextResponse.json(customers)`), not wrapped in `{ success: true, customers }`. POST returns the created customer object directly (`NextResponse.json(customer, { status: 201 })`), not wrapped. Every other CCTV endpoint wraps in `{ success: true, ... }`. The `QuickPartyDialog` happens to handle both shapes (line 72: `const newParty = await res.json()`), but the inconsistency is a trap for future consumers. |
| **CU-3** | High | POST doesn't validate phone format. Schema requires `phone: String` (non-null) but allows any string including empty. POST line 22 defaults to `""`. A customer with `phone: ""` is created silently — and the `QuickPartyDialog` dedup logic (which uses `phone` for lookup) won't match future creates of the same customer. |
| **CU-4** | High | No phone uniqueness check within a business. Schema has `@@index([phone])` but no `@@unique([businessId, phone])`. Two customers with the same phone can coexist. The `QuickPartyDialog` looks up by phone (line 49–53 of QuickPartyDialog) and returns the first match — silent ambiguity. |
| **CU-5** | Medium | No paginated GET. `findMany({ where: { businessId }, orderBy: { name: "asc" } })` returns all customers. Same N+1 issue as CL-4 if any consumer iterates with per-customer queries. |
| **CU-6** | Medium | `openingBalance` (line 24) defaults to 0 but accepts any number, including negative. A negative opening balance means the customer has a credit (we owe them). Not necessarily a bug, but no UI affordance to set it — `QuickPartyDialog` only collects name + phone + address. The opening balance field is effectively dead. |
| **CU-7** | Medium | No search query param on GET. The `QuickPartyDialog` filters client-side (line 49–53) on the full list. With 5,000 customers, this loads all 5,000 then filters. Should support `?search=` server-side. |
| **CU-8** | Low | `QuickPartyDialog` creates customers via POST (line 62) but doesn't return the new customer's `openingBalance` or `address` in the UI's `Party` interface (line 18 of QuickPartyDialog). The created customer has these fields in the DB but the UI never uses them. |
| **CU-9** | Low | No "view customer details" page. From the ledger, you can see transactions, but there's no customer profile view showing address, opening balance, total lifetime value, last sale date, etc. |

**Recommended fixes:**
- For **CU-1**: Add `src/app/api/businesses/[id]/cctv/customers/[customerId]/route.ts` with GET (single), PATCH (edit name/phone/address/openingBalance/isActive), DELETE (soft-delete via `isActive: false` — schema needs an `isActive` column added).
- For **CU-2**: Wrap responses: `return NextResponse.json({ success: true, customer }, { status: 201 })`.
- For **CU-3**: Validate phone format (Bangladesh: 11-digit starting `01`, or `+8801...`). Reject empty.
- For **CU-4**: Add `@@unique([businessId, phone])` to the schema + new migration. Handle P2002 in POST with a "phone already exists" message.
- For **CU-5/CU-7**: Add `?search=&page=&pageSize=` to GET.

### 11.3 Due Collection

**Files:** `src/app/api/businesses/[id]/cctv/reports/due-collection/route.ts` · `src/modules/cctv-shop/components/CCTVDueCollection.tsx`

| ID | Severity | Bug |
|---|---|---|
| **DC-1** | High | The aging calculation (lines 31–40) finds the **oldest unpaid sale** and ages the entire customer balance by that date. If a customer has a ৳100 sale from 90 days ago (unpaid) and a ৳5000 sale from yesterday (unpaid), the entire ৳5100 is bucketed as "90+ days". This is the opposite of FIFO — the new debt should be in "0-30 days", only the ৳100 should be "90+ days". Should compute aging per-sale, then bucket each sale's due amount separately. |
| **DC-2** | High | The "customer has due" check (line 29: `if (balance > 0)`) includes the `openingBalance` in the balance. If a customer has `openingBalance: 500` and all their sales are fully paid, they still appear in the due collection report with ৳500 due — but `unpaidSalesCount: 0` and `oldestDueDate: null`. The UI then shows "0 unpaid sale(s) · oldest: —" (UI line 109) next to a ৳500 due, which is confusing. Should separate opening-balance due from sales due. |
| **DC-3** | High | Same root cause as CL-2: balance is `openingBalance + Σ(totalAmount) − Σ(paidAmount)` (line 27). Standalone payments don't update `sale.paidAmount`, so a customer who paid ৳500 via `/payments` still shows ৳500 due here. The Due Collection report and the Customer Ledger detail disagree. |
| **DC-4** | Medium | N+1 query pattern (lines 18–56): for each customer, a separate `cCTVSale.findMany`. 5,000 customers = 5,001 queries. Same fix as CL-4 — use `groupBy` aggregation. |
| **DC-5** | Medium | No date filter. "As of" a specific date would be useful for month-end reporting. Currently always "now". |
| **DC-6** | Medium | No "collect payment" action. The report shows who owes money, but there's no button to record a payment. User has to navigate to Customer Ledger → select customer → Receive Payment. Should add a "Collect" button on each row that opens the payment dialog pre-filled with the customer and amount. |
| **DC-7** | Medium | No CSV export. A shop with 50 customers in "90+ days" wants to export the list for a collection agent. |
| **DC-8** | Medium | UI requires a manual "Load Dues" button click (line 33) — doesn't auto-load on mount. Same UX issue as R-1 (§8.6) for Stock Report. |
| **DC-9** | Low | Aging buckets (line 53) are hardcoded: `0-30 / 31-60 / 61-90 / 90+`. Some shops want `0-7 / 8-15 / 16-30 / 30+` for tighter early collection. Not configurable. |
| **DC-10** | Low | No aging-by-amount breakdown. The report shows the customer's total due in one bucket. A ৳5000 due in "90+ days" — is that one ৳5000 sale or ten ৳500 sales? The report doesn't say. |
| **DC-11** | Low | No SMS/WhatsApp integration. A shop identifying 30 customers in "90+ days" wants to send a reminder message. Currently they'd have to copy the phone number to their phone manually. |
| **DC-12** | Low | UI doesn't display `totalPurchases` or `totalPaid` (the API returns them, line 25–26, but the UI only shows `balance`, `unpaidSalesCount`, `oldestDueDate`). Useful context — a customer who bought ৳50000 and paid ৳49000 is a different risk profile than one who bought ৳1000 and paid ৳0. |

**Recommended fixes:**
- For **DC-1**: Compute aging per unpaid sale, bucket each separately, and report per-bucket totals per customer:
  ```ts
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const sale of unpaidSales) {
    const days = Math.floor((now - sale.saleDate) / (1000*60*60*24));
    const key = days > 90 ? "90+" : days > 60 ? "61-90" : days > 30 ? "31-60" : "0-30";
    buckets[key] += Number(sale.dueAmount);
  }
  ```
- For **DC-2**: Show opening-balance due separately from sales due.
- For **DC-3**: Same fix as PM-3 / CL-2.
- For **DC-4**: `groupBy` aggregation.
- For **DC-6**: Add a "Collect" button that opens the payment dialog (reuse the CCTVLedger payment dialog component).
- For **DC-8**: Auto-load on mount.

### 11.4 Expenses

**Files:** `src/app/api/businesses/[id]/cctv/expenses/route.ts` · `src/modules/cctv-shop/components/CCTVExpenses.tsx`

| ID | Severity | Bug |
|---|---|---|
| **EX-1** | High | GET `/expenses` (lines 14–32) returns `totalAmount` as the sum of expenses **on the current page only** (line 24: `expenses.reduce(...)` over the paginated `expenses` array). If a shop has 200 expenses (page 1 of 50), `totalAmount` is the sum of those 50, not all 200. The UI (line 64) shows this as "Total Expenses" — wrong. Should be a separate `_sum` aggregation over all expenses, not over the page. |
| **EX-2** | High | POST accepts a `paymentMethod` field (line 57) and uses it via `paymentMethodToAccount(body.paymentMethod || "cash")`. But the UI (`CCTVExpenses.tsx`) never sends `paymentMethod` in the request body (line 80: `JSON.stringify(form)` where `form` has only `category, description, amount, expenseDate`). So every expense silently hits the `CASH` ledger account even when the shop actually paid by bKash or bank. The Cash Book report then overstates cash outflow; the bKash/bank balance sheet accounts are understated. |
| **EX-3** | High | No edit or delete endpoint. A ৳5000 rent expense recorded with the wrong date, wrong category, or wrong amount is permanent. Only option is to record an offsetting negative expense — but POST rejects `amount <= 0` (line 38). So errors are unrecoverable. |
| **EX-4** | Medium | No `?from=&to=` or `?category=` filter on GET. The UI loads page 1 of 50 expenses. A shop wanting "tea expenses for September" has no way to filter. |
| **EX-5** | Medium | Category list is hardcoded in both the UI (lines 21–29 of CCTVExpenses.tsx) and the API (no validation, but the schema comment says "rent, electricity, transport, tea, other"). No way to add a custom category from the UI. If a shop needs "marketing" or "legal fees", they have to use "other" — losing the ability to break down expenses by category. |
| **EX-6** | Medium | No `paymentMethod` selector in the UI form (lines 194–239 of CCTVExpenses.tsx). Combined with EX-2, every expense is cash by default. Should expose the `PaymentMethodSelector` component used by POS. |
| **EX-7** | Medium | No `paidTo` field. An expense has `category` and `description` but no payee. "Salary" — paid to whom? "Transport" — which driver? Useful for audit. |
| **EX-8** | Medium | No receipt/invoice attachment. Bangladesh tax audit may require receipts for expenses above a threshold. Schema has no `attachmentUrl` field. |
| **EX-9** | Low | UI total card (line 128–138) shows `totalAmount` in red with a "Total Expenses" label. Color implies "bad" — but expenses are a normal business activity. Confusing for a shop owner. Should be neutral gray or violet. |
| **EX-10** | Low | UI list (lines 152–177) doesn't show `paymentMethod` (the API doesn't return it either — schema has no `paymentMethod` column on `CCTVExpense`). So even if EX-2 is fixed and the API records the method, the UI can't display it. |
| **EX-11** | Low | No pagination UI. The API returns paginated results (50 per page) but the UI only shows page 1. No "Load more" or page selector. A shop with 200 expenses sees only the latest 50. |
| **EX-12** | Low | No date-grouped summary (today, this week, this month, this year). The dashboard shows today's expenses (per `dashboard/route.ts` line 67–71) but the Expenses page shows no time-bucketed totals. |
| **EX-13** | Low | Expense category color map (lines 101–109 of CCTVExpenses.tsx) is hardcoded. Adding a new category in the future means a new entry here, or it falls back to `categoryColor.other`. Should live in a shared constants file. |

**Recommended fixes:**
- For **EX-1**: Compute `totalAmount` from a separate `_sum` aggregation, not from the page:
  ```ts
  const totalAmount = (await db.cCTVExpense.aggregate({
    where: { businessId },
    _sum: { amount: true },
  }))._sum.amount || 0;
  ```
- For **EX-2 / EX-6**: Add `paymentMethod` column to `CCTVExpense` schema. Add `PaymentMethodSelector` to the UI form. Send `paymentMethod` in the POST body. Validate against the enum.
- For **EX-3**: Add PATCH `/expenses/[expenseId]` (edit category/description/amount/expenseDate/paymentMethod) and DELETE (soft-delete with reversing ledger entry).
- For **EX-4**: Add `?from=&to=&category=` to GET.
- For **EX-5**: Make categories configurable — add a `CCTVExpenseCategory` table or a JSON column on `Business`.
- For **EX-7**: Add `paidTo: String?` to schema.
- For **EX-8**: Add `attachmentUrl: String?` to schema; integrate file upload via the existing `public/` directory or an S3-compatible store.
- For **EX-11**: Add "Load more" button or infinite scroll in the UI.

### 11.5 Priority summary across the Customers & Expenses section

| Priority | Bug IDs | What to fix first |
|---|---|---|
| **P0** (blocks normal use) | CL-1, CL-2, CU-1 | Fix or remove broken returns query; reconcile customer-list balance with per-customer ledger (or fix PM-3 to make both correct); add edit/delete customer endpoint |
| **P1** (data correctness) | CL-3, CL-4, CL-5, CL-6, CU-2, CU-3, CU-4, DC-1, DC-2, DC-3, EX-1, EX-2, EX-3 | Repair charges in ledger (depends on RP-7); N+1 → groupBy; date filters on ledger; sort within day; response shape consistency; phone validation; phone uniqueness; per-sale aging buckets; separate opening-balance due; reconcile due-collection with payments; totalAmount from aggregation; paymentMethod on expenses; expense edit/delete |
| **P2** (UX / consistency) | CL-7, CL-8, CL-9, CL-10, CL-11, CU-5, CU-6, CU-7, DC-4, DC-5, DC-6, DC-7, DC-8, EX-4, EX-5, EX-6, EX-7, EX-8 | Opening balance as carry-forward; unallocated payment UI; searchable combobox; virtualized ledger table; CSV export; paginated customer GET; opening balance UI; customer search; groupBy aggregation; date filter; collect button; CSV export; auto-load; date/category filter; configurable categories; paymentMethod selector; paidTo field; receipt attachment |
| **P3** (polish) | CL-12, CL-13, CL-14, CL-15, CU-8, CU-9, DC-9, DC-10, DC-11, DC-12, EX-9, EX-10, EX-11, EX-12, EX-13 | Redundant cards; discount paymentMethod misuse; amount type; void payment; QuickPartyDialog missing fields; customer profile view; configurable buckets; per-amount breakdown; SMS integration; missing context fields; color semantics; paymentMethod display; pagination UI; time-bucketed totals; shared category constants |

### 11.6 Files to touch for Section 11 fixes

| File | Fix IDs |
|---|---|
| `src/app/api/businesses/[id]/cctv/reports/customer-ledger/route.ts` | CL-1, CL-2, CL-4, CL-5, CL-6, CL-7 |
| `src/app/api/businesses/[id]/cctv/customers/route.ts` | CU-2, CU-3, CU-5, CU-7 |
| `src/app/api/businesses/[id]/cctv/customers/[customerId]/route.ts` (new) | CU-1, CU-9 |
| `src/app/api/businesses/[id]/cctv/returns/route.ts` (new, if returns are a feature) | CL-1 (depends on building the returns flow) |
| `src/modules/cctv-shop/components/CCTVLedger.tsx` | CL-8, CL-9, CL-10, CL-11, CL-13 |
| `src/modules/cctv-shop/components/QuickPartyDialog.tsx` | CU-3, CU-8 |
| `src/app/api/businesses/[id]/cctv/reports/due-collection/route.ts` | DC-1, DC-2, DC-3, DC-4, DC-5 |
| `src/modules/cctv-shop/components/CCTVDueCollection.tsx` | DC-6, DC-7, DC-8, DC-12 |
| `src/app/api/businesses/[id]/cctv/expenses/route.ts` | EX-1, EX-2, EX-3, EX-4, EX-5 |
| `src/app/api/businesses/[id]/cctv/expenses/[expenseId]/route.ts` (new) | EX-3 |
| `src/modules/cctv-shop/components/CCTVExpenses.tsx` | EX-6, EX-7, EX-9, EX-11, EX-12, EX-13 |
| `prisma/schema.prisma` + new migration | CU-1 (`isActive` on customer), CU-4 (`@@unique([businessId, phone])`), EX-2 (`paymentMethod` on expense), EX-3 (soft-delete), EX-7 (`paidTo`), EX-8 (`attachmentUrl`) |

---

*End of audit report.*
