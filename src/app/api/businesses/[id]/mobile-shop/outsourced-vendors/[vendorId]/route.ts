// GET/PUT/DELETE /api/businesses/[id]/mobile-shop/outsourced-vendors/[vendorId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const { id: businessId, vendorId } = await params;
    const vendor = await db.mSOutsourcedVendor.findFirst({
      where: { id: vendorId, businessId },
      include: {
        _count: { select: { jobCards: true } },
        jobCards: {
          where: { status: "OUTSOURCED", isActive: true },
          select: { id: true, jobCode: true, customerName: true, deviceName: true, reportedFault: true, outsourcedAt: true, expectedReturn: true, vendorCost: true },
          orderBy: { outsourcedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error("Get outsourced vendor error:", error);
    return NextResponse.json({ error: "Failed to get vendor" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const { id: businessId, vendorId } = await params;
    const body = await req.json();
    const { name, phone, address, specialization, notes, isActive } = body;

    const existing = await db.mSOutsourcedVendor.findFirst({
      where: { id: vendorId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Check duplicate name if changing
    if (name?.trim() && name.trim() !== existing.name) {
      const dup = await db.mSOutsourcedVendor.findFirst({
        where: { businessId, name: name.trim(), isActive: true, id: { not: vendorId } },
      });
      if (dup) {
        return NextResponse.json({ error: "A vendor with this name already exists" }, { status: 409 });
      }
    }

    const updated = await db.mSOutsourcedVendor.update({
      where: { id: vendorId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(specialization !== undefined ? { specialization: specialization?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: { _count: { select: { jobCards: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update outsourced vendor error:", error);
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const { id: businessId, vendorId } = await params;

    const vendor = await db.mSOutsourcedVendor.findFirst({
      where: { id: vendorId, businessId },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Check for active outsourced jobs
    const activeJobs = await db.mSJobCard.count({
      where: { vendorId, status: "OUTSOURCED", isActive: true },
    });
    if (activeJobs > 0) {
      return NextResponse.json({
        error: `Cannot delete vendor with ${activeJobs} active outsourced job(s)`,
      }, { status: 409 });
    }

    // Soft delete
    await db.mSOutsourcedVendor.update({
      where: { id: vendorId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete outsourced vendor error:", error);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}