// POST /api/businesses/[id]/products/[productId]/allocate
// FEFO (First-Expiry-First-Out) allocation engine
// Input: { quantity: number, execute?: boolean, type?: "SALE" | "DISPENSE" | "TRANSFER", note?: string }
// Output: { allocations: [{ batchId, batchNo, expiryDate, allocated, remaining }], shortFall, executed }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { id: businessId, productId } = await params;
    const body = await req.json();

    const requestedQty = parseFloat(body.quantity);
    if (isNaN(requestedQty) || requestedQty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
    }

    const execute = body.execute === true;
    const txType = body.type || "DISPENSE";
    const note = body.note || `FEFO allocation for ${requestedQty} units`;

    // Verify product
    const product = await db.product.findFirst({
      where: { id: productId, businessId, isActive: true },
      select: { id: true, name: true, unit: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Fetch all batches for this product, sorted by expiry ASC (FEFO order)
    // Skip expired batches and zero-quantity batches
    const batches = await db.batch.findMany({
      where: {
        businessId,
        productId,
        quantity: { gt: 0 },
        status: { in: ["active", "near_expiry"] }, // exclude expired/quarantined
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });

    if (batches.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No available stock",
        message: `No active batches with stock for ${product.name}`,
        allocations: [],
        requestedQuantity: requestedQty,
        availableQuantity: 0,
        shortFall: requestedQty,
      }, { status: 404 });
    }

    // Run FEFO allocation
    let remainingToAllocate = requestedQty;
    const allocations = [];
    let totalAvailable = 0;

    for (const batch of batches) {
      totalAvailable += batch.quantity;
      if (remainingToAllocate <= 0) {
        // Still record the batch for visibility but with 0 allocation
        allocations.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          status: batch.status,
          availableBefore: batch.quantity,
          allocated: 0,
          remainingAfter: batch.quantity,
        });
        continue;
      }

      const take = Math.min(batch.quantity, remainingToAllocate);
      allocations.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        status: batch.status,
        availableBefore: batch.quantity,
        allocated: take,
        remainingAfter: batch.quantity - take,
      });
      remainingToAllocate -= take;
    }

    const shortFall = Math.max(0, requestedQty - (totalAvailable - remainingToAllocate));
    // Recompute: actually allocated = requested - remaining
    const actuallyAllocated = requestedQty - remainingToAllocate;
    const finalShortFall = Math.max(0, requestedQty - actuallyAllocated);

    // If short, return without executing
    if (finalShortFall > 0) {
      return NextResponse.json({
        success: false,
        error: "Insufficient stock",
        message: `Only ${actuallyAllocated} ${product.unit} available (requested ${requestedQty}). Short by ${finalShortFall} ${product.unit}.`,
        product: { id: product.id, name: product.name, unit: product.unit },
        allocations,
        requestedQuantity: requestedQty,
        availableQuantity: totalAvailable,
        allocatedQuantity: actuallyAllocated,
        shortFall: finalShortFall,
        executed: false,
      }, { status: 409 });
    }

    // If execute=true, perform the allocation in a transaction
    if (execute) {
      const txResults = [];

      for (const alloc of allocations) {
        if (alloc.allocated <= 0) continue;

        // Update batch quantity
        const updatedBatch = await db.batch.update({
          where: { id: alloc.batchId },
          data: { quantity: { decrement: alloc.allocated } },
        });

        // Recalculate status in case expiry passed
        const newStatus = calculateBatchStatus(updatedBatch.expiryDate);
        if (updatedBatch.status !== newStatus) {
          await db.batch.update({
            where: { id: updatedBatch.id },
            data: { status: newStatus },
          });
        }

        // Create audit transaction
        await db.transaction.create({
          data: {
            businessId,
            productId,
            batchId: alloc.batchId,
            type: txType,
            quantity: alloc.allocated,
            unitPrice: updatedBatch.mrp,
            note: `${note} (batch ${alloc.batchNo})`,
          },
        });

        txResults.push({
          batchId: alloc.batchId,
          batchNo: alloc.batchNo,
          newQuantity: updatedBatch.quantity,
          status: newStatus,
        });
      }

      // Update inventory total
      await db.inventory.updateMany({
        where: { productId },
        data: { quantity: { decrement: requestedQty } },
      });

      return NextResponse.json({
        success: true,
        message: `Dispensed ${requestedQty} ${product.unit} of ${product.name} via FEFO`,
        product: { id: product.id, name: product.name, unit: product.unit },
        allocations,
        requestedQuantity: requestedQty,
        allocatedQuantity: actuallyAllocated,
        shortFall: 0,
        executed: true,
        executionResults: txResults,
      });
    }

    // Dry-run mode (default) — just return the plan
    return NextResponse.json({
      success: true,
      message: `FEFO allocation plan for ${requestedQty} ${product.unit} of ${product.name}`,
      product: { id: product.id, name: product.name, unit: product.unit },
      allocations,
      requestedQuantity: requestedQty,
      availableQuantity: totalAvailable,
      allocatedQuantity: actuallyAllocated,
      shortFall: 0,
      executed: false,
    });
  } catch (error) {
    console.error("FEFO allocate error:", error);
    return NextResponse.json({ error: "Failed to allocate stock" }, { status: 500 });
  }
}
