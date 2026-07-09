// GET /api/businesses/[id]/stock-count-day/expected-qty
// Returns expected shop-wide quantities for products during an active SCD zone scan.
//
// Query params:
//   zoneSessionId — required
//   productIds    — comma-separated product IDs

import { NextRequest, NextResponse } from "next/server";
import { getScdExpectedQtyForProducts } from "@/lib/scd";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  const url = new URL(req.url);
  const zoneSessionId = url.searchParams.get("zoneSessionId") || "";
  const productIdsParam = url.searchParams.get("productIds") || "";

  if (!zoneSessionId) {
    return NextResponse.json({ error: "zoneSessionId is required" }, { status: 400 });
  }

  const productIds = productIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  try {
    const result = await getScdExpectedQtyForProducts(
      businessId,
      zoneSessionId,
      productIds
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      zoneName: result.zoneName,
      byProduct: result.byProduct,
    });
  } catch (error) {
    console.error("SCD expected qty error:", error);
    return NextResponse.json({ error: "Failed to load expected quantities" }, { status: 500 });
  }
}
