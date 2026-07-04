// POST /api/businesses/[id]/storage-zones/[zoneId]/assign-products
// Bulk-add products to a zone (keeps other zone assignments intact).
import { NextRequest, NextResponse } from "next/server";
import { addProductsToZone } from "@/lib/scd";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  const { id: businessId, zoneId } = await params;
  try {
    const body = await req.json();
    const productIds = Array.isArray(body.productIds) ? body.productIds as string[] : [];
    if (productIds.length === 0) {
      return NextResponse.json({ error: "productIds array is required" }, { status: 400 });
    }

    const result = await addProductsToZone(businessId, zoneId, productIds);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, added: result.added });
  } catch (error) {
    console.error("Bulk zone assign error:", error);
    return NextResponse.json({ error: "Failed to assign products" }, { status: 500 });
  }
}
