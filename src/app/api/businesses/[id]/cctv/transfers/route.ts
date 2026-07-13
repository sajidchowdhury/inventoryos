// GET/POST /api/businesses/[id]/cctv/transfers
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || "";

    const where: Record<string, unknown> = { businessId };
    if (status) {
      where.status = status;
    }

    const transfers = await db.mSTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transfers);
  } catch (error) {
    console.error("List transfers error:", error);
    return NextResponse.json({ error: "Failed to list transfers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { fromBranchId, toBranchId, notes, serialItemIds } = body;

    if (!fromBranchId || !toBranchId) {
      return NextResponse.json({ error: "fromBranchId and toBranchId are required" }, { status: 400 });
    }
    if (fromBranchId === toBranchId) {
      return NextResponse.json({ error: "Source and destination branches must be different" }, { status: 400 });
    }
    if (!Array.isArray(serialItemIds) || serialItemIds.length === 0) {
      return NextResponse.json({ error: "At least one serial item is required" }, { status: 400 });
    }

    // Validate branches
    const [fromBranch, toBranch] = await Promise.all([
      db.mSBranch.findFirst({ where: { id: fromBranchId, businessId, isActive: true } }),
      db.mSBranch.findFirst({ where: { id: toBranchId, businessId, isActive: true } }),
    ]);
    if (!fromBranch) return NextResponse.json({ error: "Source branch not found" }, { status: 404 });
    if (!toBranch) return NextResponse.json({ error: "Destination branch not found" }, { status: 404 });

    // Validate serial items: must be IN_STOCK at the fromBranch
    const serialItems = await db.mSSerialItem.findMany({
      where: {
        id: { in: serialItemIds },
        businessId,
        status: "IN_STOCK",
        branchId: fromBranchId,
        isActive: true,
      },
    });

    if (serialItems.length !== serialItemIds.length) {
      const foundIds = new Set(serialItems.map((i) => i.id));
      const invalidIds = serialItemIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        {
          error: `${invalidIds.length} item(s) are not available for transfer. They may not be IN_STOCK at the source branch.`,
          invalidItemIds: invalidIds,
          validCount: serialItems.length,
        },
        { status: 409 }
      );
    }

    // Auto-generate transfer code
    const year = new Date().getFullYear();
    const lastTransfer = await db.mSTransfer.findFirst({
      where: {
        businessId,
        transferCode: { startsWith: `TRF-${year}-` },
      },
      orderBy: { transferCode: "desc" },
      select: { transferCode: true },
    });

    let seq = 1;
    if (lastTransfer) {
      const parts = lastTransfer.transferCode.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const transferCode = `TRF-${year}-${String(seq).padStart(3, "0")}`;

    // Create transfer + items (status stays DRAFT, serial items unchanged)
    const transfer = await db.mSTransfer.create({
      data: {
        businessId,
        transferCode,
        fromBranchId,
        toBranchId,
        notes: notes?.trim() || null,
        status: "DRAFT",
        items: {
          create: serialItemIds.map((serialItemId: string) => ({
            businessId,
            serialItemId,
            status: "IN_TRANSIT", // transfer item status (not serial item status)
          })),
        },
      },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        items: { include: { serialItem: { include: { product: { select: { id: true, name: true, brand: true } } } } } },
      },
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error("Create transfer error:", error);
    return NextResponse.json({ error: "Failed to create transfer" }, { status: 500 });
  }
}