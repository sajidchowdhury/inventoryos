// GET/PUT/DELETE /api/businesses/[id]/customers/[customerId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, invoiceNo: true, totalAmount: true, status: true,
            paymentStatus: true, createdAt: true, itemCount: true,
          },
        },
        _count: { select: { sales: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Get customer error:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;
    const body = await req.json();

    const existing = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check duplicate phone if changing
    if (body.phone && body.phone !== existing.phone) {
      const dup = await db.customer.findFirst({
        where: { businessId, phone: body.phone, isActive: true, NOT: { id: customerId } },
      });
      if (dup) {
        return NextResponse.json(
          { error: `Phone ${body.phone} already in use by another customer` },
          { status: 400 }
        );
      }
    }

    const customer = await db.customer.update({
      where: { id: customerId },
      data: {
        name: body.name !== undefined ? body.name.trim() : existing.name,
        phone: body.phone !== undefined ? (body.phone?.trim() || null) : existing.phone,
        email: body.email !== undefined ? (body.email?.trim() || null) : existing.email,
        address: body.address !== undefined ? (body.address?.trim() || null) : existing.address,
        dateOfBirth: body.dateOfBirth !== undefined
          ? (body.dateOfBirth ? new Date(body.dateOfBirth) : null)
          : existing.dateOfBirth,
        gender: body.gender !== undefined ? (body.gender || null) : existing.gender,
        chronicConditions: body.chronicConditions !== undefined
          ? (body.chronicConditions?.trim() || null) : existing.chronicConditions,
        allergies: body.allergies !== undefined
          ? (body.allergies?.trim() || null) : existing.allergies,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Update customer error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;

    const existing = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
      include: { _count: { select: { sales: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Soft delete — preserve sales history
    await db.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `Customer deleted (${existing._count.sales} sales preserved in history)`,
    });
  } catch (error) {
    console.error("Delete customer error:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
