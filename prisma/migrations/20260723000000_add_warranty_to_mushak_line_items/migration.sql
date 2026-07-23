-- AlterTable: Add warranty fields to MSMushakLineItem
-- These fields carry warranty info from product/serial item to the Mushak invoice line item

ALTER TABLE "mobile_shop_mushak_line_items" ADD COLUMN "warrantyMonths" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "mobile_shop_mushak_line_items" ADD COLUMN "warrantyEnd" TIMESTAMP(3);
ALTER TABLE "mobile_shop_mushak_line_items" ADD COLUMN "warrantyNote" TEXT;
