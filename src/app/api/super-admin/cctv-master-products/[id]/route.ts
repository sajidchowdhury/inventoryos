// GET/PUT/DELETE /api/super-admin/cctv-master-products/[id]

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../master-products/_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await db.mSMasterProduct.findUnique({
    where: { id },
    include: {
      manufacturer: { select: { id: true, name: true } },
    },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, product });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = [
      "name", "brand", "model", "sku", "description", "hsnCode",
      "defaultCategoryName", "defaultWarrantyMonths", "defaultSerialTracked",
      "defaultUnit", "defaultImageUrl", "defaultVatRate", "defaultMrp",
      "isActive", "isApproved",
    ];
    const data: Record<string, unknown> = {};
    for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

    // Handle manufacturer separately (it's a relation, not a direct field)
    if (body.manufacturer !== undefined) {
      if (body.manufacturer) {
        const mfr = await db.masterManufacturer.upsert({
          where: { name: body.manufacturer },
          update: {},
          create: { name: body.manufacturer },
        });
        data.manufacturerId = mfr.id;
      } else {
        data.manufacturerId = null;
      }
    }

    const product = await db.mSMasterProduct.update({
      where: { id },
      data,
      include: { manufacturer: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[cctv-master-products] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update CCTV master product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  // Soft delete — set isActive to false
  await db.mSMasterProduct.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ success: true });
}
