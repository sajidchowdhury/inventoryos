// GET/PUT/DELETE /api/businesses/[id]/products/[productId]
// Individual product operations
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { id: businessId, productId } = await params;

    const product = await db.product.findFirst({
      where: { id: productId, businessId, isActive: true },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true, slug: true } },
        inventory: true,
        batches: {
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Get product error:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { id: businessId, productId } = await params;
    const body = await req.json();

    // Verify product belongs to this business
    const existing = await db.product.findFirst({
      where: { id: productId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const product = await db.product.update({
      where: { id: productId },
      data: {
        name: body.name ?? existing.name,
        genericName: body.genericName ?? existing.genericName,
        sku: body.sku ?? existing.sku,
        barcode: body.barcode ?? existing.barcode,
        productType: body.productType ?? existing.productType,
        unit: body.unit ?? existing.unit,
        stripSize: body.stripSize ?? existing.stripSize,
        boxSize: body.boxSize ?? existing.boxSize,
        strength: body.strength ?? existing.strength,
        dosageForm: body.dosageForm ?? existing.dosageForm,
        manufacturer: body.manufacturer ?? existing.manufacturer,
        scheduleType: body.scheduleType ?? existing.scheduleType,
        hsnCode: body.hsnCode ?? existing.hsnCode,
        vatRate: body.vatRate ?? existing.vatRate,
        mrp: body.mrp ?? existing.mrp,
        isPrescription: body.isPrescription ?? existing.isPrescription,
        storageCondition: body.storageCondition ?? existing.storageCondition,
        rackNo: body.rackNo ?? existing.rackNo,
        minStock: body.minStock ?? existing.minStock,
        maxStock: body.maxStock ?? existing.maxStock,
        reorderLevel: body.reorderLevel ?? existing.reorderLevel,
        categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        inventory: true,
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { id: businessId, productId } = await params;

    // Verify product belongs to this business
    const existing = await db.product.findFirst({
      where: { id: productId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Soft delete — mark as inactive
    await db.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
