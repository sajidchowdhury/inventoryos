// GET/POST /api/businesses/[id]/batches
// GET: List batches with filters (by product, status, expiring soon)
// POST: Create a new batch (also updates Inventory quantity)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Auto-calculate batch status based on expiry date
function calculateBatchStatus(expiryDate: Date): string {
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const productId = url.searchParams.get("productId") || "";
    const status = url.searchParams.get("status") || ""; // active, near_expiry, expired
    const expiringDays = url.searchParams.get("expiringDays") || ""; // e.g., "30" for next 30 days
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (productId) where.productId = productId;
    if (status) where.status = status;
    if (expiringDays) {
      const now = new Date();
      const future = new Date(now.getTime() + parseInt(expiringDays) * 24 * 60 * 60 * 1000);
      where.expiryDate = { gte: now, lte: future };
    }

    const [batches, total] = await Promise.all([
      db.batch.findMany({
        where,
        include: {
          product: {
            select: {
              id: true, name: true, genericName: true, strength: true,
              dosageForm: true, manufacturer: true, unit: true, mrp: true,
              category: { select: { id: true, name: true, color: true } },
            },
          },
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      db.batch.count({ where }),
    ]);

    // Auto-update stale statuses (cheap check — only updates if expired)
    const now = new Date();
    const updates: Promise<unknown>[] = [];
    batches.forEach((b) => {
      const correctStatus = calculateBatchStatus(b.expiryDate);
      if (b.status !== correctStatus && b.status === "active") {
        updates.push(
          db.batch.update({ where: { id: b.id }, data: { status: correctStatus } })
        );
        b.status = correctStatus;
      }
    });
    if (updates.length > 0) await Promise.all(updates);

    // Summary counts
    const summary = await db.batch.groupBy({
      by: ["status"],
      where: { businessId },
      _sum: { quantity: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      batches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: summary.reduce((acc, s) => {
        acc[s.status] = { count: s._count, quantity: s._sum.quantity ?? 0 };
        return acc;
      }, {} as Record<string, { count: number; quantity: number }>),
    });
  } catch (error) {
    console.error("Get batches error:", error);
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Validate required fields
    if (!body.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!body.batchNo || !body.batchNo.trim()) {
      return NextResponse.json({ error: "Batch number is required" }, { status: 400 });
    }
    if (!body.expiryDate) {
      return NextResponse.json({ error: "Expiry date is required" }, { status: 400 });
    }

    // Verify product belongs to this business
    const product = await db.product.findFirst({
      where: { id: body.productId, businessId, isActive: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check for duplicate batch number for same product
    const existing = await db.batch.findFirst({
      where: {
        businessId,
        productId: body.productId,
        batchNo: body.batchNo.trim(),
        status: { in: ["active", "near_expiry"] },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Batch "${body.batchNo}" already exists for this product` },
        { status: 400 }
      );
    }

    const quantity = parseFloat(body.quantity) || 0;
    const expiryDate = new Date(body.expiryDate);
    const status = calculateBatchStatus(expiryDate);

    // Create batch
    const batch = await db.batch.create({
      data: {
        businessId,
        productId: body.productId,
        batchNo: body.batchNo.trim(),
        mfgDate: body.mfgDate ? new Date(body.mfgDate) : null,
        expiryDate,
        quantity,
        purchasePrice: body.purchasePrice ? parseFloat(body.purchasePrice) : null,
        mrp: body.mrp ? parseFloat(body.mrp) : null,
        supplierId: body.supplierId || null,
        status,
        notes: body.notes || null,
      },
      include: {
        product: {
          select: { id: true, name: true, genericName: true, strength: true, unit: true },
        },
      },
    });

    // Update inventory: add batch quantity to total
    const inventory = await db.inventory.findUnique({
      where: { productId: body.productId },
    });

    if (inventory) {
      await db.inventory.update({
        where: { productId: body.productId },
        data: {
          quantity: inventory.quantity + quantity,
          minStock: body.minStock !== undefined ? parseFloat(body.minStock) : inventory.minStock,
          unitCost: body.purchasePrice ? parseFloat(body.purchasePrice) : inventory.unitCost,
        },
      });
    } else {
      await db.inventory.create({
        data: {
          businessId,
          productId: body.productId,
          quantity,
          minStock: parseFloat(body.minStock) || 0,
          unitCost: body.purchasePrice ? parseFloat(body.purchasePrice) : null,
        },
      });
    }

    // Create a PURCHASE transaction for audit trail
    await db.transaction.create({
      data: {
        businessId,
        productId: body.productId,
        batchId: batch.id,
        type: "PURCHASE",
        quantity,
        unitPrice: body.purchasePrice ? parseFloat(body.purchasePrice) : null,
        note: `Batch ${body.batchNo} added (expiry: ${expiryDate.toISOString().split("T")[0]})`,
      },
    });

    return NextResponse.json({ success: true, batch }, { status: 201 });
  } catch (error) {
    console.error("Create batch error:", error);
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }
}
