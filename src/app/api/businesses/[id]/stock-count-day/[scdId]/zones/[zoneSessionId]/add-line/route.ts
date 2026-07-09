// POST /api/businesses/[id]/stock-count-day/[scdId]/zones/[zoneSessionId]/add-line
// P3: Manually add a product to a zone count session from the directory.
// Body: { productId: string, userId?: string }
import { NextRequest, NextResponse } from "next/server";
import { addZoneCountLine, getZoneSessionDetail } from "@/lib/scd";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scdId: string; zoneSessionId: string }> }
) {
  const { id: businessId, zoneSessionId } = await params;
  try {
    const body = await req.json();
    const productId = body.productId as string | undefined;
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const result = await addZoneCountLine(businessId, zoneSessionId, {
      productId,
      userId: body.userId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Return the updated zone session detail so the UI can refresh the line list
    const detail = await getZoneSessionDetail(zoneSessionId, businessId);
    return NextResponse.json({
      success: true,
      line: result.line,
      ...detail,
    });
  } catch (error) {
    console.error("Add zone count line error:", error);
    return NextResponse.json({ error: "Failed to add product to zone" }, { status: 500 });
  }
}
