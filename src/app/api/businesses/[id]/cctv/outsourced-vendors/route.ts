// GET/POST /api/businesses/[id]/cctv/outsourced-vendors
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = { businessId };
    if (!includeInactive) where.isActive = true;
    if (search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { specialization: { contains: search.trim() } },
      ];
    }

    const vendors = await db.cCTVOutsourcedVendor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { jobCards: true } },
      },
    });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error("List outsourced vendors error:", error);
    return NextResponse.json({ error: "Failed to list vendors" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { name, phone, address, specialization, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }

    // Check duplicate name
    const existing = await db.cCTVOutsourcedVendor.findFirst({
      where: { businessId, name: name.trim(), isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: "A vendor with this name already exists" }, { status: 409 });
    }

    const vendor = await db.cCTVOutsourcedVendor.create({
      data: {
        businessId,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        specialization: specialization?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: {
        _count: { select: { jobCards: true } },
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("Create outsourced vendor error:", error);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }
}