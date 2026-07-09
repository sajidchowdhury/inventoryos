// GET/POST /api/businesses/[id]/suppliers
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          _count: { select: { purchases: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.supplier.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      suppliers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get suppliers error:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    // Auto-generate code if not provided
    let code = body.code?.trim() || null;
    if (!code) {
      const count = await db.supplier.count({ where: { businessId } });
      code = `SUP-${(count + 1).toString().padStart(3, "0")}`;
    }

    // Check for duplicate code
    const existing = await db.supplier.findFirst({
      where: { businessId, code },
    });
    if (existing) {
      return NextResponse.json({ error: `Supplier code ${code} already exists` }, { status: 409 });
    }

    const supplier = await db.supplier.create({
      data: {
        businessId,
        name: body.name.trim(),
        code,
        contactPerson: body.contactPerson?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error) {
    console.error("Create supplier error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
