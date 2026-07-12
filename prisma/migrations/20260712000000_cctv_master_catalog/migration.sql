-- AlterTable
ALTER TABLE "cctv_products" ADD COLUMN     "masterProductId" TEXT;
-- CreateTable
CREATE TABLE "cctv_master_products" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "hsnCode" TEXT,
    "defaultCategoryName" TEXT,
    "defaultWarrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "defaultSerialTracked" BOOLEAN NOT NULL DEFAULT false,
    "defaultUnit" TEXT NOT NULL DEFAULT 'piece',
    "defaultImageUrl" TEXT,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultMrp" DOUBLE PRECISION,
    "specs" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "submittedByBusinessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cctv_master_products_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "cctv_master_products_brand_idx" ON "cctv_master_products"("brand");
-- CreateIndex
CREATE INDEX "cctv_master_products_name_idx" ON "cctv_master_products"("name");
-- CreateIndex
CREATE INDEX "cctv_master_products_manufacturerId_idx" ON "cctv_master_products"("manufacturerId");
-- CreateIndex
CREATE INDEX "cctv_master_products_isActive_idx" ON "cctv_master_products"("isActive");
-- CreateIndex
CREATE INDEX "cctv_master_products_isApproved_idx" ON "cctv_master_products"("isApproved");
-- CreateIndex
CREATE UNIQUE INDEX "cctv_master_products_brand_model_key" ON "cctv_master_products"("brand", "model");
-- CreateIndex
CREATE INDEX "cctv_products_masterProductId_idx" ON "cctv_products"("masterProductId");
-- AddForeignKey
ALTER TABLE "cctv_master_products" ADD CONSTRAINT "cctv_master_products_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "master_manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "cctv_master_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
