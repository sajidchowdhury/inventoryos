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
  // E-7: race condition — two concurrent POSTs both see count = N, both
  // generate EST-2609-001. The schema has no @@unique([businessId, estimateNo])
  // constraint, so both insert successfully with duplicate numbers. We
  // can't add the unique constraint without a migration (and the existing
  // duplicates would block it), so instead we retry the whole create with
  // an incremented sequence if a P2002 ever fires (defensive — won't fire
  // today but future-proofs against a later migration adding the unique).
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `EST-${yy}${mm}-`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calculate total
  let totalAmount = 0;
  for (const item of body.items) {
    totalAmount += (item.unitPrice || 0) * (item.quantity || 1);
  }

  // E-7: retry loop (max 5). Each attempt recomputes the count + adds the
  // attempt number to the sequence.
  const MAX_RETRIES = 5;
  let estimate: any = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const monthCount = await db.cCTVEstimate.count({
      where: { businessId, createdAt: { gte: monthStart } },
    });
    const estimateNo = `${monthPrefix}${String(monthCount + 1 + attempt).padStart(3, "0")}`;

    try {
      estimate = await db.cCTVEstimate.create({
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
      break; // success
    } catch (err: any) {
      // E-7: if a unique constraint on estimateNo is added in the future,
      // retry with the next sequence number. Today (no unique constraint),
      // this never fires — but the retry is defensive.
      if (err?.code === "P2002" && (err?.meta?.target as string[])?.includes("estimateNo")) {
        continue; // retry with attempt+1
      }
      throw err;
    }
  }

  return NextResponse.json({ success: true, estimate }, { status: 201 });
}
