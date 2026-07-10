// GET/PUT/DELETE /api/businesses/[id]/cctv/branches/[branchId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: businessId, branchId } = await params;

    const branch = await db.cCTVBranch.findFirst({
      where: { id: branchId, businessId, isActive: true },
      include: {
        _count: {
          select: {
            serialItems: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Compute inventory breakdown
    const inStock = await db.cCTVSerialItem.count({
      where: { branchId, businessId, status: "IN_STOCK", isActive: true },
    });
    const inTransit = await db.cCTVSerialItem.count({
      where: { branchId, businessId, status: "IN_TRANSIT", isActive: true },
    });
    const total = await db.cCTVSerialItem.count({
      where: { branchId, businessId, isActive: true },
    });

    // Recent transfers (both directions, last 5)
    const recentTransfers = await db.cCTVTransfer.findMany({
      where: {
        businessId,
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
      },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({ ...branch, inventory: { inStock, inTransit, total }, recentTransfers });
  } catch (error) {
    console.error("Get branch error:", error);
    return NextResponse.json({ error: "Failed to get branch" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: businessId, branchId } = await params;
    const body = await req.json();
    const { name, code, address, phone, isDefault } = body;

    const existing = await db.cCTVBranch.findFirst({
      where: { id: branchId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // If setting as default, unset all others first
    if (isDefault === true && !existing.isDefault) {
      await db.cCTVBranch.updateMany({
        where: { businessId, isActive: true, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check code uniqueness if changed
    if (code && code.trim().toUpperCase() !== existing.code) {
      const codeUpper = code.trim().toUpperCase();
      const dup = await db.cCTVBranch.findFirst({
        where: { businessId, code: codeUpper, isActive: true, id: { not: branchId } },
      });
      if (dup) {
        return NextResponse.json({ error: `Branch code "${codeUpper}" is already in use` }, { status: 409 });
      }
    }

    const updated = await db.cCTVBranch.update({
      where: { id: branchId },
      data: {
        name: name?.trim() || undefined,
        code: code?.trim().toUpperCase() || undefined,
        address: address !== undefined ? (address?.trim() || null) : undefined,
        phone: phone !== undefined ? (phone?.trim() || null) : undefined,
        isDefault: isDefault !== undefined ? isDefault : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update branch error:", error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: businessId, branchId } = await params;

    const branch = await db.cCTVBranch.findFirst({
      where: { id: branchId, businessId, isActive: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }
    if (branch.isDefault) {
      return NextResponse.json({ error: "Cannot delete the default branch" }, { status: 400 });
    }

    // Check for IN_STOCK or IN_TRANSIT items
    const activeItems = await db.cCTVSerialItem.count({
      where: {
        branchId,
        businessId,
        status: { in: ["IN_STOCK", "IN_TRANSIT"] },
        isActive: true,
      },
    });
    if (activeItems > 0) {
      return NextResponse.json(
        { error: `Cannot delete branch with ${activeItems} active item(s). Transfer or move them first.` },
        { status: 409 }
      );
    }

    await db.cCTVBranch.update({
      where: { id: branchId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete branch error:", error);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}