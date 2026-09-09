// GET/POST /api/businesses/[id]/cctv/customers
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
// CU-5: GET is paginated (default 50, max 200) with pagination metadata.
// CU-7: GET accepts ?search= for server-side filtering by name or phone
//   (case-insensitive). The QuickPartyDialog + CCTVLedger combobox can now
//   delegate to the server instead of loading all 5000+ customers.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);

  // CU-7: server-side search
  const search = searchParams.get("search") || "";
  // CU-5: pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50") || 50));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { businessId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    db.cCTVCustomer.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
    db.cCTVCustomer.count({ where }),
  ]);

  // CU-5: backward compat — old callers did `setCustomers(data)` expecting
  // an array. We now return { success, customers, pagination }. Existing UIs
  // that did `data.customers || (Array.isArray(data) ? data : [])` still work.
  return NextResponse.json({
    success: true,
    customers,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
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
      openingBalance: body.openingBalance || 0,  // CU-6: accepted from the UI now
    },
  });
  // CU-2 fix: wrap in { success: true, customer } for consistency
  return NextResponse.json({ success: true, customer }, { status: 201 });
}
