// GET/POST /api/businesses/[id]/returns
// GET: List returns
// POST: Process a return (refund + restock)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

async function generateReturnNo(businessId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RET-${year}-`;
  const lastReturn = await db.return.findFirst({
    where: { businessId, returnNo: { startsWith: prefix } },
    orderBy: { returnNo: "desc" },
    select: { returnNo: true },
  });
  let nextNum = 1;
  if (lastReturn) {
    const match = lastReturn.returnNo.match(/RET-\d{4}-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const saleId = url.searchParams.get("saleId") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (saleId) where.saleId = saleId;
    if (customerId) where.customerId = customerId;

    const [returns, total] = await Promise.all([
      db.return.findMany({
        where,
        include: {
          sale: { select: { id: true, invoiceNo: true, totalAmount: true } },
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.return.count({ where }),
    ]);

    // Summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayReturns = await db.return.aggregate({
      where: { businessId, createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { refundAmount: true },
      _count: true,
    });

    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    const monthReturns = await db.return.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { refundAmount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      returns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        today: { count: todayReturns._count, refund: todayReturns._sum.refundAmount || 0 },
        month: { count: monthReturns._count, refund: monthReturns._sum.refundAmount || 0 },
      },
    });
  } catch (error) {
    console.error("Get returns error:", error);
    return NextResponse.json({ error: "Failed to fetch returns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Validate
    if (!body.saleId) {
      return NextResponse.json({ error: "saleId is required" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one return item is required" }, { status: 400 });
    }
    const validReasons = ["defective", "wrong_item", "expired", "customer_changed_mind", "other"];
    if (!body.reason || !validReasons.includes(body.reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${validReasons.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch sale with items
    const sale = await db.sale.findFirst({
      where: { id: body.saleId, businessId },
      include: { items: true },
    });
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    if (sale.status === "cancelled") {
      return NextResponse.json({ error: "Cannot return items from a cancelled sale" }, { status: 400 });
    }

    // Validate each return item
    let totalRefund = 0;
    const returnItemsData = [];
    for (const item of body.items) {
      const saleItem = sale.items.find((si) => si.id === item.saleItemId);
      if (!saleItem) {
        return NextResponse.json(
          { error: `Sale item not found: ${item.saleItemId}` },
          { status: 404 }
        );
      }
      const returnQty = parseFloat(item.quantity);
      if (isNaN(returnQty) || returnQty <= 0) {
        return NextResponse.json({ error: "Return quantity must be positive" }, { status: 400 });
      }
      if (returnQty > saleItem.quantity) {
        return NextResponse.json(
          { error: `Cannot return ${returnQty} ${saleItem.unit} of ${saleItem.productName}. Sale item only had ${saleItem.quantity} ${saleItem.unit}.` },
          { status: 400 }
        );
      }

      // Check if already returned (sum of previous returns for this item)
      const previousReturns = await db.returnItem.aggregate({
        where: { saleItemId: item.saleItemId },
        _sum: { quantity: true },
      });
      const alreadyReturned = previousReturns._sum.quantity || 0;
      if (returnQty + alreadyReturned > saleItem.quantity) {
        return NextResponse.json(
          { error: `Already returned ${alreadyReturned} ${saleItem.unit}. Cannot return ${returnQty} more (only ${saleItem.quantity - alreadyReturned} remaining).` },
          { status: 400 }
        );
      }

      const refundAmount = returnQty * saleItem.unitPrice;
      totalRefund += refundAmount;

      returnItemsData.push({
        saleItemId: item.saleItemId,
        productId: saleItem.productId,
        batchId: saleItem.batchId,
        productName: saleItem.productName,
        quantity: returnQty,
        unitPrice: saleItem.unitPrice,
        refundAmount,
      });
    }

    // Cap refund to sale total
    if (totalRefund > sale.totalAmount) {
      totalRefund = sale.totalAmount;
    }

    const restockItems = body.restockItems !== false; // default true
    const refundMethod = body.refundMethod || "cash";
    const returnNo = await generateReturnNo(businessId);

    // Atomic: create return + items + restock + refund
    const result = await db.$transaction(async (tx) => {
      // Create return record
      const newReturn = await tx.return.create({
        data: {
          businessId,
          saleId: body.saleId,
          customerId: sale.customerId,
          returnNo,
          status: "completed",
          refundAmount: totalRefund,
          refundMethod,
          restockItems,
          reason: body.reason,
          notes: body.notes?.trim() || null,
          processedBy: body.processedBy || null,
        },
      });

      // Create return items + restock
      for (const item of returnItemsData) {
        await tx.returnItem.create({
          data: {
            returnId: newReturn.id,
            saleItemId: item.saleItemId,
            businessId,
            productId: item.productId,
            batchId: item.batchId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            refundAmount: item.refundAmount,
          },
        });

        if (restockItems && item.batchId) {
          // Restore batch quantity
          const batch = await tx.batch.update({
            where: { id: item.batchId },
            data: { quantity: { increment: item.quantity } },
          });
          // Recalc status
          const newStatus = calculateBatchStatus(batch.expiryDate);
          if (batch.status !== newStatus) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { status: newStatus },
            });
          }
        }

        if (restockItems) {
          // Restore inventory
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }

        // Audit transaction
        await tx.transaction.create({
          data: {
            businessId,
            productId: item.productId,
            batchId: item.batchId,
            type: "RETURN",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            note: `Return ${returnNo} for sale ${sale.invoiceNo} — ${body.reason}`,
          },
        });
      }

      // Update sale: reduce paidAmount if refund > 0
      // (refundAmount reduces the effective payment)
      const newPaidAmount = Math.max(0, sale.paidAmount - totalRefund);
      let newPaymentStatus = sale.paymentStatus;
      if (newPaidAmount >= sale.totalAmount) newPaymentStatus = "paid";
      else if (newPaidAmount > 0) newPaymentStatus = "partial";
      else newPaymentStatus = "unpaid";

      if (refundMethod === "cash" || refundMethod === "store_credit") {
        await tx.sale.update({
          where: { id: body.saleId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus: newPaymentStatus,
          },
        });
      }
      // If refundMethod === "credit", the sale's paidAmount stays (credit is tracked separately)

      return newReturn;
    });

    // Fetch complete return with items
    const completeReturn = await db.return.findUnique({
      where: { id: result.id },
      include: {
        items: {
          include: {
            product: { select: { name: true, unit: true } },
          },
        },
        sale: { select: { invoiceNo: true } },
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      return: completeReturn,
      message: `Return ${returnNo} processed — Refund: ৳${totalRefund.toFixed(2)} via ${refundMethod}${restockItems ? " — items restocked" : ""}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Create return error:", error);
    return NextResponse.json({ error: "Failed to process return" }, { status: 500 });
  }
}
