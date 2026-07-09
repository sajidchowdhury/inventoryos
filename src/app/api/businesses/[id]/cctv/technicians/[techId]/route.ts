// GET/PUT/DELETE /api/businesses/[id]/cctv/technicians/[techId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; techId: string }> },
) {
  try {
    const { id: businessId, techId } = await params;
    const tech = await db.cCTVTechnician.findFirst({
      where: { id: techId, businessId },
      include: { _count: { select: { commissionRecords: true } } },
    });
    if (!tech) return NextResponse.json({ error: "Technician not found" }, { status: 404 });
    return NextResponse.json(tech);
  } catch (error) {
    console.error("Get technician error:", error);
    return NextResponse.json({ error: "Failed to get technician" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; techId: string }> },
) {
  try {
    const { id: businessId, techId } = await params;
    const body = await req.json();

    const existing = await db.cCTVTechnician.findFirst({
      where: { id: techId, businessId },
    });
    if (!existing) return NextResponse.json({ error: "Technician not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.displayName !== undefined) data.displayName = String(body.displayName).trim();
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.specialization !== undefined) data.specialization = body.specialization ? String(body.specialization).trim() : null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const updated = await db.cCTVTechnician.update({
      where: { id: techId },
      data,
      include: { _count: { select: { commissionRecords: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update technician error:", error);
    return NextResponse.json({ error: "Failed to update technician" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; techId: string }> },
) {
  try {
    const { id: businessId, techId } = await params;
    const existing = await db.cCTVTechnician.findFirst({
      where: { id: techId, businessId },
    });
    if (!existing) return NextResponse.json({ error: "Technician not found" }, { status: 404 });

    await db.cCTVTechnician.update({
      where: { id: techId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete technician error:", error);
    return NextResponse.json({ error: "Failed to delete technician" }, { status: 500 });
  }
}