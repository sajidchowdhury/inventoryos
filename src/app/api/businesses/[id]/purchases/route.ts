// GET/POST /api/businesses/[id]/purchases
// POST creates a purchase with auto-batch creation + inventory update
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

async function generatePurchaseNo(businessId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const last = await db.purchase.findFirst({
    where: { businessId, purchaseNo: { startsWith: prefix } },
    orderBy: { purchaseNo: "desc" },
    select: { purchaseNo: true },
  });
  let nextNum = 1;
  if (last) {
    const match = last.purchaseNo.match(/PO-\d{4}-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const supplierId = url.searchParams.get("supplierId") || "";
    const status = url.searchParams.get("status") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const [purchases, total] = await Promise.all([
      db.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true, phone: true } },
          items: {
            select: {
              id: true, productName: true, quantity: true, receivedQuantity: true,
              unit: true, unitCost: true, totalPrice: true, batchNo: true,
            },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.purchase.count({ where }),
    ]);

    // Summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayPurchases = await db.purchase.aggregate({
      where: { businessId, createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { totalAmount: true },
      _count: true,
    });

    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    const monthPurchases = await db.purchase.aggregate({
      where: { businessId, createdAt: { gte: monthStart }, status: { not: "cancelled" } },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Outstanding payables
    const outstanding = await db.purchase.aggregate({
      where: { businessId, status: "received", paymentStatus: { in: ["partial", "unpaid"] } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      purchases,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        today: { count: todayPurchases._count, total: todayPurchases._sum.totalAmount || 0 },
        month: { count: monthPurchases._count, total: monthPurchases._sum.totalAmount || 0 },
        outstanding: {
          count: outstanding._count,
          totalAmount: outstanding._sum.totalAmount || 0,
          paidAmount: outstanding._sum.paidAmount || 0,
          dueAmount: (outstanding._sum.totalAmount || 0) - (outstanding._sum.paidAmount || 0),
        },
      },
    });
  } catch (error) {
    console.error("Get purchases error:", error);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Validate items
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Validate each item
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      if (!item.productId || isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: "Each item needs productId and positive quantity" }, { status: 400 });
      }
      const cost = parseFloat(item.unitCost);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json({ error: "Each item needs a valid unitCost" }, { status: 400 });
      }
      // For pharmacy: expiry date is strongly recommended
      if (!item.expiryDate) {
        return NextResponse.json(
          { error: `Expiry date is required for ${item.productName || "each item"} (pharmacy requirement)` },
          { status: 400 }
        );
      }
    }

    // Verify supplier if provided
    if (body.supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: body.supplierId, businessId, isActive: true },
      });
      if (!supplier) {
        return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
      }
    }

    // Generate purchase number
    const purchaseNo = await generatePurchaseNo(businessId);

    // Calculate totals
    let subtotal = 0;
    const itemsData = [];
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      const cost = parseFloat(item.unitCost);
      const lineTotal = qty * cost;
      subtotal += lineTotal;
      itemsData.push({
        productId: item.productId,
        productName: item.productName || "",
        quantity: qty,
        receivedQuantity: qty, // auto-receive on creation
        unit: item.unit || "piece",
        unitCost: cost,
        totalPrice: lineTotal,
        batchNo: item.batchNo?.trim() || `AUTO-${Date.now()}`,
        expiryDate: new Date(item.expiryDate),
        mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
        mrp: item.mrp ? parseFloat(item.mrp) : null,
      });
    }

    const discountAmount = parseFloat(body.discountAmount) || 0;
    const taxAmount = parseFloat(body.taxAmount) || 0;
    const totalAmount = Math.max(0, subtotal - discountAmount) + taxAmount;
    const paidAmount = parseFloat(body.paidAmount) || 0;
    let paymentStatus = "unpaid";
    if (paidAmount >= totalAmount) paymentStatus = "paid";
    else if (paidAmount > 0) paymentStatus = "partial";

    // Create purchase + items + batches + inventory update atomically
    const purchase = await db.$transaction(async (tx) => {
      // Create Purchase
      const newPurchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId: body.supplierId || null,
          purchaseNo,
          status: "received",
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount,
          paymentStatus,
          invoiceNo: body.invoiceNo?.trim() || null,
          invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
          receivedDate: new Date(),
          notes: body.notes?.trim() || null,
          createdBy: body.createdBy || null,
        },
      });

      // Create items + batches
      for (const item of itemsData) {
        // Verify product exists
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId, isActive: true },
          select: { id: true, name: true, unit: true },
        });
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Use product name if not provided
        const productName = item.productName || product.name;
        const unit = item.unit || product.unit;

        // Create batch for this item
        const batchStatus = calculateBatchStatus(item.expiryDate);
        const batch = await tx.batch.create({
          data: {
            businessId,
            productId: item.productId,
            batchNo: item.batchNo,
            mfgDate: item.mfgDate,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            purchasePrice: item.unitCost,
            mrp: item.mrp,
            supplierId: body.supplierId || null,
            status: batchStatus,
          },
        });

        // Create purchase item
        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            businessId,
            productId: item.productId,
            batchId: batch.id,
            productName,
            quantity: item.quantity,
            receivedQuantity: item.quantity,
            unit,
            unitCost: item.unitCost,
            totalPrice: item.totalPrice,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            mfgDate: item.mfgDate,
            mrp: item.mrp,
          },
        });

        // Update inventory
        const inventory = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (inventory) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: {
              quantity: { increment: item.quantity },
              unitCost: item.unitCost,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              businessId,
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
            },
          });
        }

        // Create PURCHASE audit transaction
        await tx.transaction.create({
          data: {
            businessId,
            productId: item.productId,
            batchId: batch.id,
            type: "PURCHASE",
            quantity: item.quantity,
            unitPrice: item.unitCost,
            note: `Purchase ${purchaseNo} — Batch ${item.batchNo} (supplier: ${body.supplierName || "N/A"})`,
          },
        });
      }

      // Update supplier balance + totals
      if (body.supplierId) {
        await tx.supplier.update({
          where: { id: body.supplierId },
          data: {
            totalPurchased: { increment: totalAmount },
            balance: { increment: totalAmount - paidAmount },
            totalPaid: { increment: paidAmount },
          },
        });
      }

      return newPurchase;
    });

    // Fetch complete purchase with items
    const completePurchase = await db.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            batch: { select: { id: true, batchNo: true, expiryDate: true, status: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      purchase: completePurchase,
      message: `Purchase ${purchaseNo} created — ${body.items.length} items received, ${itemsData.length} batches created. Total: ৳${totalAmount.toFixed(2)}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Create purchase error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create purchase" },
      { status: 500 }
    );
  }
}
