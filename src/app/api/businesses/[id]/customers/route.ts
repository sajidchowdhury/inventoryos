// GET/POST /api/businesses/[id]/customers
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
      ];
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          _count: { select: { sales: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    // Check for duplicate phone (if provided)
    if (body.phone) {
      const existing = await db.customer.findFirst({
        where: { businessId, phone: body.phone, isActive: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Customer with phone ${body.phone} already exists`, existingCustomer: existing },
          { status: 409 }
        );
      }
    }

    const customer = await db.customer.create({
      data: {
        businessId,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender || null,
        chronicConditions: body.chronicConditions?.trim() || null,
        allergies: body.allergies?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error) {
    console.error("Create customer error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
