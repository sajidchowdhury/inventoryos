// GET/PATCH/DELETE /api/businesses/[id]/cctv/products/[productId]
// F-1: Product edit and delete endpoints (previously missing entirely).
//
// GET: returns a single product by id (must match businessId).
// PATCH: edits editable fields (name, brand, model, sku, categoryId,
//   costPrice, sellPrice, minStock, warrantyMonths, unit, serialTracked,
//   description, imageUrl, isActive). Does NOT allow editing stock
//   directly (stock is managed by purchases/sales; use stock-in flow
//   or a manual adjustment for that).
// DELETE: soft-delete (sets isActive: false) by default. If the product
//   has no purchases, sales, or serial items referencing it, hard-deletes
//   instead. If it HAS references, soft-delete only — the product
//   disappears from the active list but historical records are preserved.
//
// SUB-1: PATCH and DELETE are guarded by requireActiveSubscription.
//   GET is NOT guarded (viewing a product is always allowed, even in
//   read_only mode — the user needs to see what they have).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: businessId, productId } = await params;

  const product = await db.cCTVProduct.findFirst({
    where: { id: productId, businessId },
    include: { category: { select: { id: true, name: true, color: true, icon: true, slug: true } } },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, product });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: businessId, productId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  // Verify the product exists + belongs to this business
  const existing = await db.cCTVProduct.findFirst({
    where: { id: productId, businessId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Build the update data — only include fields that were provided
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.brand !== undefined) updateData.brand = body.brand;
  if (body.model !== undefined) updateData.model = body.model || null;
  if (body.sku !== undefined) updateData.sku = body.sku || null;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
  if (body.costPrice !== undefined) updateData.costPrice = body.costPrice;
  if (body.sellPrice !== undefined) updateData.sellPrice = body.sellPrice;
  if (body.minStock !== undefined) updateData.minStock = body.minStock;
  if (body.warrantyMonths !== undefined) updateData.warrantyMonths = body.warrantyMonths;
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.serialTracked !== undefined) updateData.serialTracked = body.serialTracked;
  if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  // NOTE: stock is intentionally NOT editable via PATCH. Stock is
  // managed by purchases (increment) and sales (decrement). Direct
  // stock edits bypass the audit trail and would break the invariant
  // test (Fix 5). Use the stock-in (purchase) flow or add a manual
  // adjustment endpoint with a CCTVStockMovement audit row.

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.cCTVProduct.update({
    where: { id: productId },
    data: updateData,
    include: { category: { select: { id: true, name: true, color: true, icon: true, slug: true } } },
  });

  return NextResponse.json({ success: true, product: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: businessId, productId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  // Verify the product exists + belongs to this business
  const existing = await db.cCTVProduct.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Check if the product has any references (purchases, sales, serials)
  const [purchaseCount, saleCount, serialCount] = await Promise.all([
    db.cCTVPurchaseItem.count({ where: { productId } }),
    db.cCTVSaleItem.count({ where: { productId } }),
    db.cCTVSerialItem.count({ where: { productId } }),
  ]);

  const hasReferences = purchaseCount > 0 || saleCount > 0 || serialCount > 0;

  if (hasReferences) {
    // Soft-delete: set isActive = false. The product disappears from
    // the active list but historical records (sales, purchases, serials)
    // are preserved for audit.
    await db.cCTVProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });
    return NextResponse.json({
      success: true,
      message: "Product deactivated (soft-delete). It has existing sales/purchases/serials so it cannot be permanently deleted. It will no longer appear in the product list.",
      deleted: false,
    });
  }

  // Hard-delete: no references exist, so it's safe to remove permanently
  await db.cCTVProduct.delete({
    where: { id: productId },
  });

  return NextResponse.json({
    success: true,
    message: "Product permanently deleted (no existing sales/purchases/serials).",
    deleted: true,
  });
}
