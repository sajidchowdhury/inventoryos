// GET/PUT/DELETE /api/businesses/[id]/cctv/products/[productId]
// GET: Get a single CCTV product with category and serial item count
// PUT: Update a CCTV product (partial fields)
// DELETE: Soft-delete a CCTV product (set isActive=false)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  try {
    const { id: businessId, productId } = await params;

    const product = await db.cCTVProduct.findFirst({
      where: { id: productId, businessId, isActive: true },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true, slug: true } },
        masterProduct: { select: { id: true, name: true, brand: true, model: true } },
        _count: { select: { serialItems: { where: { isActive: true } } } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Get CCTV product error:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  try {
    const { id: businessId, productId } = await params;
    const body = await req.json();

    const existing = await db.cCTVProduct.findFirst({
      where: { id: productId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // String fields
    const stringFields = ["name", "brand", "model", "sku", "description", "hsnCode", "imageUrl", "unit"];
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === null ? null : String(body[field]);
      }
    }

    // Nullable string field for categoryId
    if (body.categoryId !== undefined) {
      updateData.categoryId = body.categoryId === null ? null : String(body.categoryId);
    }

    // Nullable string field for masterProductId (catalog link)
    if (body.masterProductId !== undefined) {
      updateData.masterProductId = body.masterProductId === null ? null : String(body.masterProductId);
    }

    // Numeric fields
    const numberFields = ["costPrice", "sellPrice", "vatRate", "stock", "minStock", "maxStock", "warrantyMonths"];
    for (const field of numberFields) {
      if (body[field] !== undefined) {
        updateData[field] = Number(body[field]);
      }
    }

    // Nullable mrp
    if (body.mrp !== undefined) {
      updateData.mrp = body.mrp === null ? null : Number(body.mrp);
    }

    // Boolean fields
    if (body.serialTracked !== undefined) updateData.serialTracked = Boolean(body.serialTracked);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    const product = await db.cCTVProduct.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true, slug: true } },
        masterProduct: { select: { id: true, name: true, brand: true, model: true } },
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Update CCTV product error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  try {
    const { id: businessId, productId } = await params;

    const existing = await db.cCTVProduct.findFirst({
      where: { id: productId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await db.cCTVProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("Delete CCTV product error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}