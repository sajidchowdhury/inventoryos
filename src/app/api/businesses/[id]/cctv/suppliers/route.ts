// GET/POST /api/businesses/[id]/cctv/suppliers
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const suppliers = await db.cCTVSupplier.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const supplier = await db.cCTVSupplier.create({
    data: {
      businessId,
      name: body.name,
      phone: body.phone || "",
      address: body.address || null,
      openingBalance: body.openingBalance || 0,
    },
  });
  return NextResponse.json(supplier, { status: 201 });
}
