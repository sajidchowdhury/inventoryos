// GET /api/businesses/[id]/catalog/cctv/brands
// Returns a list of distinct brands in the CCTV master catalog.
// Used to populate a brand filter dropdown in the user-side product creation form.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: _businessId } = await params; // businessId not used for query, but kept for auth consistency

  try {
    // Query distinct brands from the MSMasterProduct table
    const brands = await db.mSMasterProduct.findMany({
      where: { isActive: true, isApproved: true },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });

    return NextResponse.json({
      success: true,
      brands: brands.map(b => b.brand),
    });
  } catch (error) {
    console.error("[catalog/cctv/brands] failed:", error);
    return NextResponse.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
}
