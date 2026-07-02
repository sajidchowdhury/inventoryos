// GET/PUT/DELETE /api/businesses/[id]/suppliers/[supplierId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: businessId, supplierId } = await params;

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, businessId },
      include: {
        purchases: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
            status: true, paymentStatus: true, createdAt: true,
            _count: { select: { items: true } },
          },
        },
        _count: { select: { purchases: true, batches: true } },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, supplier });
  } catch (error) {
    console.error("Get supplier error:", error);
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: businessId, supplierId } = await params;
    const body = await req.json();

    const existing = await db.supplier.findFirst({
      where: { id: supplierId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Check duplicate code if changing
    if (body.code && body.code !== existing.code) {
      const dup = await db.supplier.findFirst({
        where: { businessId, code: body.code, NOT: { id: supplierId } },
      });
      if (dup) {
        return NextResponse.json({ error: `Code ${body.code} already in use` }, { status: 400 });
      }
    }

    const supplier = await db.supplier.update({
      where: { id: supplierId },
      data: {
        name: body.name !== undefined ? body.name.trim() : existing.name,
        code: body.code !== undefined ? (body.code?.trim() || existing.code) : existing.code,
        contactPerson: body.contactPerson !== undefined ? (body.contactPerson?.trim() || null) : existing.contactPerson,
        phone: body.phone !== undefined ? (body.phone?.trim() || null) : existing.phone,
        email: body.email !== undefined ? (body.email?.trim() || null) : existing.email,
        address: body.address !== undefined ? (body.address?.trim() || null) : existing.address,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
      },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (error) {
    console.error("Update supplier error:", error);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: businessId, supplierId } = await params;

    const existing = await db.supplier.findFirst({
      where: { id: supplierId, businessId, isActive: true },
      include: { _count: { select: { purchases: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Soft delete — preserve purchase history
    await db.supplier.update({
      where: { id: supplierId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `Supplier deleted (${existing._count.purchases} purchases preserved in history)`,
    });
  } catch (error) {
    console.error("Delete supplier error:", error);
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
