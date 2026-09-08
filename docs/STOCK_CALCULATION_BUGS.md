# Stock Calculation Audit — Bugs & Recommended Fixes

> **Auditor:** External review (2026-09-08)
> **Scope:** CCTV module — purchase / sale / stock-report / product-movement / purchase-report / sales-report
> **Status:** Open — fixes not yet applied

---

## TL;DR

Stock math for **non-serial** CCTV products is correct and race-safe.
Stock math for **serial-tracked** CCTV products is **partially broken**: the `CCTVProduct.stock` column is incremented on purchase but never decremented on sale. Reader endpoints work around this in *some* places (Stock Report, Dashboard) but not everywhere (Products List), and aggregation reports (Purchase Report, Sales Report, Product Movement running balance) are accurate only if the frontend always sends a `quantity` field that matches the actual serial count.

Two related bugs exist in the "add item to existing sale" endpoint that allow double-selling the same serial and creating out-of-balance books.

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

---

*End of audit report.*
