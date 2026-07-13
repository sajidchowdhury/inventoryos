// POST /api/businesses/[id]/catalog/cctv/suggest
// Allows a CCTV shop owner to submit a new product for inclusion in the master catalog.
// Creates a MSMasterProduct with isApproved: false (pending admin review).
// Returns the new masterProductId so the caller can link the MSProduct to it.
//
// Body: {
//   name: "DS-2CD2143G2-I 4MP Bullet Camera",
//   brand: "Hikvision",
//   model: "DS-2CD2143G2-I",
//   sku: "HKV-2143",              // optional
//   description: "...",            // optional
//   hsnCode: "8525.89.00",        // optional
//   defaultCategoryName: "Cameras", // optional
//   defaultWarrantyMonths: 12,    // optional
//   defaultSerialTracked: true,   // optional
//   defaultUnit: "piece",         // optional
//   defaultVatRate: 15,           // optional
//   defaultMrp: 6500,             // optional
// }
//
// Returns: { success, masterProductId, isApproved, message }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const {
      name, brand, model, sku, description, hsnCode,
      defaultCategoryName, defaultWarrantyMonths, defaultSerialTracked,
      defaultUnit, defaultVatRate, defaultMrp,
    } = body;

    // Validate required fields
    if (!name || !brand || !model) {
      return NextResponse.json(
        { error: "name, brand, and model are required" },
        { status: 400 }
      );
    }

    // Check if a master product with this (brand, model) already exists
    const existing = await db.mSMasterProduct.findUnique({
      where: { brand_model: { brand, model } },
    });

    if (existing) {
      // Already in the catalog — return the existing masterProductId
      // The caller should link their MSProduct to this existing entry
      return NextResponse.json({
        success: true,
        masterProductId: existing.id,
        isApproved: existing.isApproved,
        message: existing.isApproved
          ? "Product already exists in the master catalog"
          : "Product already exists in the master catalog (pending admin review)",
      });
    }

    // Create a new master product with isApproved: false (pending admin review)
    const masterProduct = await db.mSMasterProduct.create({
      data: {
        name,
        brand,
        model,
        sku: sku || null,
        description: description || null,
        hsnCode: hsnCode || null,
        defaultCategoryName: defaultCategoryName || null,
        defaultWarrantyMonths: defaultWarrantyMonths ?? 0,
        defaultSerialTracked: defaultSerialTracked ?? false,
        defaultUnit: defaultUnit || "piece",
        defaultVatRate: defaultVatRate ?? 0,
        defaultMrp: defaultMrp || null,
        isApproved: false, // pending admin review
        submittedByBusinessId: businessId, // attribution
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      masterProductId: masterProduct.id,
      isApproved: false,
      message: "Product submitted to the master catalog (pending admin review)",
    }, { status: 201 });
  } catch (error) {
    console.error("[catalog/cctv/suggest] failed:", error);
    return NextResponse.json({ error: "Failed to submit product suggestion" }, { status: 500 });
  }
}
