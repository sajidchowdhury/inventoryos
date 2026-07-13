// POST /api/businesses/[id]/cctv/kits/[kitId]/components
// Add a component to a kit
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  try {
    const { id: businessId, kitId } = await params;
    const body = await req.json();
    const { productId, quantity, componentLabel, isRequired, sortOrder } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Verify kit exists
    const kit = await db.mSKitDefinition.findFirst({
      where: { id: kitId, businessId, isActive: true },
    });
    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    // Verify product exists and belongs to business
    const product = await db.mSProduct.findFirst({
      where: { id: productId, businessId, isActive: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check for duplicate product in this kit
    const existing = await db.mSKitComponent.findFirst({
      where: { kitId, productId },
    });
    if (existing) {
      return NextResponse.json({ error: "This product is already a component of this kit" }, { status: 409 });
    }

    // Determine sort order
    const maxSort = await db.mSKitComponent.findFirst({
      where: { kitId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextSort = (maxSort?.sortOrder ?? -1) + 1;

    const component = await db.mSKitComponent.create({
      data: {
        kitId,
        businessId,
        productId,
        quantity: quantity ?? 1,
        componentLabel: componentLabel?.trim() || null,
        isRequired: isRequired ?? true,
        sortOrder: sortOrder ?? nextSort,
      },
      include: {
        product: { select: { id: true, name: true, brand: true, sellPrice: true, stock: true, serialTracked: true, imageUrl: true } },
      },
    });

    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error("Add kit component error:", error);
    return NextResponse.json({ error: "Failed to add component" }, { status: 500 });
  }
}