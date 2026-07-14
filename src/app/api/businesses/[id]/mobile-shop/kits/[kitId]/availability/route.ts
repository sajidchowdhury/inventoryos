// GET /api/businesses/[id]/mobile-shop/kits/[kitId]/availability
// Checks stock availability for all kit components
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  try {
    const { id: businessId, kitId } = await params;

    const kit = await db.mSKitDefinition.findFirst({
      where: { id: kitId, businessId, isActive: true },
      include: {
        components: {
          include: {
            product: { select: { id: true, name: true, brand: true, sellPrice: true, costPrice: true, stock: true, serialTracked: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    const componentResults = [];

    for (const comp of kit.components) {
      const product = comp.product;
      if (!product) {
        componentResults.push({
          component: comp,
          product: null,
          required: comp.quantity,
          available: 0,
          sufficient: false,
        });
        continue;
      }

      // For serial-tracked products, count IN_STOCK serial items
      // For non-serial, use the product.stock field
      let available: number;
      if (product.serialTracked) {
        available = await db.mSSerialItem.count({
          where: { productId: product.id, businessId, status: "IN_STOCK", isActive: true },
        });
      } else {
        available = product.stock;
      }

      componentResults.push({
        component: comp,
        product,
        required: comp.quantity,
        available,
        sufficient: available >= comp.quantity,
      });
    }

    // Calculate pricing
    const requiredComponents = componentResults.filter((c) => c.component.isRequired);
    const individualTotal = requiredComponents.reduce(
      (sum, c) => sum + (c.product?.sellPrice || 0) * c.component.quantity,
      0
    );

    const discountAmount = individualTotal * (kit.discountPercent / 100);
    const effectiveKitPrice = kit.kitPrice ?? (individualTotal - discountAmount);

    // Max complete kits = min of (available / required) across all required components
    const requiredAvailabilities = componentResults.filter((c) => c.component.isRequired);
    const maxComplete = requiredAvailabilities.length > 0
      ? Math.min(...requiredAvailabilities.map((c) => Math.floor(c.available / c.required)))
      : 0;

    const canFulfill = maxComplete >= 1;

    return NextResponse.json({
      kit: {
        id: kit.id,
        name: kit.name,
        slug: kit.slug,
        kitPrice: kit.kitPrice,
        discountPercent: kit.discountPercent,
      },
      canFulfill,
      maxComplete,
      components: componentResults,
      individualTotal,
      kitPrice: effectiveKitPrice,
    });
  } catch (error) {
    console.error("Kit availability error:", error);
    return NextResponse.json({ error: "Failed to check kit availability" }, { status: 500 });
  }
}