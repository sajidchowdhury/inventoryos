// GET/POST /api/businesses/[id]/mobile-shop/technicians
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") !== "false";

    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.isActive = true;

    const technicians = await db.mSTechnician.findMany({
      where,
      include: {
        _count: { select: { commissionRecords: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(technicians);
  } catch (error) {
    console.error("List technicians error:", error);
    return NextResponse.json({ error: "Failed to list technicians" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { displayName, phone, specialization } = body;

    if (!displayName?.trim()) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    const technician = await db.mSTechnician.create({
      data: {
        businessId,
        displayName: displayName.trim(),
        phone: phone?.trim() || null,
        specialization: specialization?.trim() || null,
      },
      include: {
        _count: { select: { commissionRecords: true } },
      },
    });

    return NextResponse.json(technician, { status: 201 });
  } catch (error) {
    console.error("Create technician error:", error);
    return NextResponse.json({ error: "Failed to create technician" }, { status: 500 });
  }
}