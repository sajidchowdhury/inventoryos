// GET /api/businesses/[id]/mobile-shop/serial-items
// List serial items with search, status filter, and limit
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const status = url.searchParams.get("status") || "";
    const search = url.searchParams.get("search") || "";
    const grade = url.searchParams.get("grade") || "";
    const productId = url.searchParams.get("productId") || "";
    const branchId = url.searchParams.get("branchId") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const page = parseInt(url.searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (status) where.status = status;
    if (grade) where.grade = grade;
    if (productId) where.productId = productId;
    if (branchId) where.branchId = branchId;

    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { imei: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { product: { brand: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      db.mSSerialItem.findMany({
        where,
        select: {
          id: true,
          serialNumber: true,
          imei: true,
          status: true,
          grade: true,
          costPrice: true,
          sellPrice: true,
          warrantyMonths: true,
          warrantyStart: true,
          warrantyEnd: true,
          customerName: true,
          branchId: true,
          currentLocation: true,
          notes: true,
          source: true,
          createdAt: true,
          product: {
            select: { id: true, name: true, brand: true, imageUrl: true, sellPrice: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.mSSerialItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("List serial items error:", error);
    return NextResponse.json({ error: "Failed to list serial items" }, { status: 500 });
  }
}