// GET /api/businesses/[id]/cctv/branches/[branchId]/inventory
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: businessId, branchId } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";

    // Verify branch exists
    const branch = await db.cCTVBranch.findFirst({
      where: { id: branchId, businessId, isActive: true },
      select: { id: true, name: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const where: Record<string, unknown> = {
      branchId,
      businessId,
      isActive: true,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { imei: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { product: { brand: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      db.cCTVSerialItem.findMany({
        where,
        include: { product: { select: { id: true, name: true, brand: true, imageUrl: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.cCTVSerialItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Branch inventory error:", error);
    return NextResponse.json({ error: "Failed to fetch branch inventory" }, { status: 500 });
  }
}