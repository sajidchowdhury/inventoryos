-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 6: Stock Movement Audit Table
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Create cctv_stock_movements table for complete stock change
-- traceability. Every stock change (purchase, sale, return, replacement)
-- creates a movement record with: what changed, by how much, why, and
-- the resulting balance.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE "cctv_stock_movements" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT,
    "movementType" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_stock_movements_pkey" PRIMARY KEY ("id")
);

-- Indexes for fast queries
CREATE INDEX "cctv_stock_movements_businessId_idx" ON "cctv_stock_movements"("businessId");
CREATE INDEX "cctv_stock_movements_productId_idx" ON "cctv_stock_movements"("productId");
CREATE INDEX "cctv_stock_movements_businessId_productId_idx" ON "cctv_stock_movements"("businessId", "productId");
CREATE INDEX "cctv_stock_movements_movementType_idx" ON "cctv_stock_movements"("movementType");
CREATE INDEX "cctv_stock_movements_createdAt_idx" ON "cctv_stock_movements"("createdAt");

-- Foreign key to businesses (cascade delete)
ALTER TABLE "cctv_stock_movements"
  ADD CONSTRAINT "cctv_stock_movements_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE;
