// GET/POST /api/businesses/[id]/cctv/customers
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const customers = await db.cCTVCustomer.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const customer = await db.cCTVCustomer.create({
    data: {
      businessId,
      name: body.name,
      phone: body.phone || "",
      address: body.address || null,
      openingBalance: body.openingBalance || 0,
    },
  });
  return NextResponse.json(customer, { status: 201 });
}
