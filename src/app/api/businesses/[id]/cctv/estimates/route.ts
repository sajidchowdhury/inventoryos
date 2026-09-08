// GET/POST /api/businesses/[id]/cctv/estimates
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { businessId };
  if (status) where.status = status;

  // E-9: Pagination — previous `take: 100` silently dropped anything past row
  // 100 for shops with 200+ estimates. Now accepts ?page=&pageSize= and returns
  // pagination metadata. Default pageSize=50 to match other CCTV list endpoints.
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50") || 50));
  const skip = (page - 1) * pageSize;

  const [estimates, total] = await Promise.all([
    db.cCTVEstimate.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.cCTVEstimate.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    estimates,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  // Generate estimate number: EST-{YYMM}-{NNN}
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `EST-${yy}${mm}-`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = await db.cCTVEstimate.count({
    where: { businessId, createdAt: { gte: monthStart } },
  });
  const estimateNo = `${monthPrefix}${String(monthCount + 1).padStart(3, "0")}`;

  // Calculate total
  let totalAmount = 0;
  for (const item of body.items) {
    totalAmount += (item.unitPrice || 0) * (item.quantity || 1);
  }

  // Create estimate
  const estimate = await db.cCTVEstimate.create({
    data: {
      businessId,
      estimateNo,
      customerId: body.customerId || null,
      customerName: body.customerName || null,
      customerPhone: body.customerPhone || null,
      projectTitle: body.projectTitle || null,
      totalAmount,
      status: body.status || "draft",
      notes: body.notes || null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      items: {
        create: body.items.map((item: any) => ({
          businessId,
          productId: item.productId || null,
          productName: item.productName,
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          notes: item.notes || null,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({ success: true, estimate }, { status: 201 });
}
