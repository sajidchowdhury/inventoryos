// POST /api/businesses/[id]/dispense
// Multi-item dispense using FEFO allocation
// Input: { items: [{ productId, quantity }], note?: string }
// Output: Per-item allocation results + overall success/failure
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

interface DispenseItem {
  productId: string;
  quantity: number;
}

interface DispenseResult {
  productId: string;
  productName: string;
  unit: string;
  requested: number;
  allocated: number;
  shortFall: number;
  success: boolean;
  allocations: Array<{
    batchId: string;
    batchNo: string;
    expiryDate: Date;
    allocated: number;
  }>;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    const items: DispenseItem[] = body.items;
    const note = body.note || "Quick dispense";

    // Validate all items first
    for (const item of items) {
      const qty = parseFloat(item.quantity);
      if (!item.productId) {
        return NextResponse.json({ error: "All items must have productId" }, { status: 400 });
      }
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: "All quantities must be positive numbers" }, { status: 400 });
      }
    }

    const results: DispenseResult[] = [];
    let totalSuccess = 0;
    let totalFailures = 0;
    let totalValue = 0;

    // Process each item via FEFO
    for (const item of items) {
      const requestedQty = parseFloat(item.quantity);

      // Fetch product
      const product = await db.product.findFirst({
        where: { id: item.productId, businessId, isActive: true },
        select: { id: true, name: true, unit: true },
      });

      if (!product) {
        results.push({
          productId: item.productId,
          productName: "Unknown",
          unit: "",
          requested: requestedQty,
          allocated: 0,
          shortFall: requestedQty,
          success: false,
          allocations: [],
          error: "Product not found",
        });
        totalFailures++;
        continue;
      }

      // Fetch batches in FEFO order
      const batches = await db.batch.findMany({
        where: {
          businessId,
          productId: item.productId,
          quantity: { gt: 0 },
          status: { in: ["active", "near_expiry"] },
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      });

      // Run FEFO allocation
      let remaining = requestedQty;
      const allocations = [];
      let totalAvailable = 0;

      for (const batch of batches) {
        totalAvailable += batch.quantity;
        if (remaining <= 0) continue;

        const take = Math.min(batch.quantity, remaining);
        allocations.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          allocated: take,
        });
        remaining -= take;
      }

      const allocated = requestedQty - remaining;
      const shortFall = Math.max(0, requestedQty - allocated);

      if (shortFall > 0) {
        results.push({
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          requested: requestedQty,
          allocated,
          shortFall,
          success: false,
          allocations,
          error: `Insufficient stock: only ${allocated} of ${requestedQty} ${product.unit} available`,
        });
        totalFailures++;
        continue;
      }

      // Execute the allocation
      for (const alloc of allocations) {
        if (alloc.allocated <= 0) continue;

        const updatedBatch = await db.batch.update({
          where: { id: alloc.batchId },
          data: { quantity: { decrement: alloc.allocated } },
        });

        // Recalc status
        const newStatus = calculateBatchStatus(updatedBatch.expiryDate);
        if (updatedBatch.status !== newStatus) {
          await db.batch.update({
            where: { id: updatedBatch.id },
            data: { status: newStatus },
          });
        }

        totalValue += (updatedBatch.mrp || 0) * alloc.allocated;

        // Audit transaction
        await db.transaction.create({
          data: {
            businessId,
            productId: product.id,
            batchId: alloc.batchId,
            type: "SALE",
            quantity: alloc.allocated,
            unitPrice: updatedBatch.mrp,
            note: `${note} (batch ${alloc.batchNo})`,
          },
        });
      }

      // Update inventory
      await db.inventory.updateMany({
        where: { productId: product.id },
        data: { quantity: { decrement: requestedQty } },
      });

      results.push({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        requested: requestedQty,
        allocated,
        shortFall: 0,
        success: true,
        allocations,
      });
      totalSuccess++;
    }

    const allSuccess = totalFailures === 0;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? `Dispensed ${totalSuccess} item(s) successfully`
        : `${totalSuccess} succeeded, ${totalFailures} failed`,
      summary: {
        totalItems: items.length,
        success: totalSuccess,
        failures: totalFailures,
        totalValue,
      },
      results,
    });
  } catch (error) {
    console.error("Quick dispense error:", error);
    return NextResponse.json({ error: "Failed to dispense" }, { status: 500 });
  }
}
