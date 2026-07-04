// PATCH/DELETE /api/businesses/[id]/storage-zones/[zoneId]
import { NextRequest, NextResponse } from "next/server";
import { updateStorageZone } from "@/lib/scd";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  const { id: businessId, zoneId } = await params;
  try {
    const body = await req.json();
    const zone = await updateStorageZone(businessId, zoneId, {
      name: body.name,
      color: body.color,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, zone });
  } catch (error) {
    console.error("Update storage zone error:", error);
    return NextResponse.json({ error: "Failed to update zone" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  const { id: businessId, zoneId } = await params;
  try {
    const zone = await db.storageZone.findFirst({
      where: { id: zoneId, businessId },
    });
    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }
    await updateStorageZone(businessId, zoneId, { isActive: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete storage zone error:", error);
    return NextResponse.json({ error: "Failed to delete zone" }, { status: 500 });
  }
}
