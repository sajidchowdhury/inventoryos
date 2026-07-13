// PUT/DELETE /api/businesses/[id]/cctv/kits/[kitId]/components/[componentId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string; componentId: string }> }
) {
  try {
    const { id: businessId, kitId, componentId } = await params;
    const body = await req.json();
    const { quantity, componentLabel, isRequired, sortOrder } = body;

    const component = await db.mSKitComponent.findFirst({
      where: { id: componentId, kitId, businessId },
    });
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const updated = await db.mSKitComponent.update({
      where: { id: componentId },
      data: {
        quantity: quantity !== undefined ? quantity : undefined,
        componentLabel: componentLabel !== undefined ? (componentLabel?.trim() || null) : undefined,
        isRequired: isRequired !== undefined ? isRequired : undefined,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined,
      },
      include: {
        product: { select: { id: true, name: true, brand: true, sellPrice: true, stock: true, serialTracked: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update kit component error:", error);
    return NextResponse.json({ error: "Failed to update component" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string; componentId: string }> }
) {
  try {
    const { id: businessId, kitId, componentId } = await params;

    const component = await db.mSKitComponent.findFirst({
      where: { id: componentId, kitId, businessId },
    });
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    await db.mSKitComponent.delete({ where: { id: componentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete kit component error:", error);
    return NextResponse.json({ error: "Failed to remove component" }, { status: 500 });
  }
}