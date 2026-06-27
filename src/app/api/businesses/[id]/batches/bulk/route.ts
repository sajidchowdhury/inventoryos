// POST /api/businesses/[id]/batches/bulk
// Apply an action to multiple batches at once
// Body: {
//   batchIds: string[],
//   action: "quarantine" | "dispose" | "return_to_supplier" | "release" | "delete",
//   reason?: string,         // for quarantine/dispose
//   disposalMethod?: string, // for dispose
//   witness?: string,        // for dispose
//   notes?: string,          // for any
//   supplierName?: string,   // for return_to_supplier
// }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_ACTIONS = ["quarantine", "dispose", "return_to_supplier", "release", "delete"];

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!Array.isArray(body.batchIds) || body.batchIds.length === 0) {
      return NextResponse.json({ error: "batchIds array is required" }, { status: 400 });
    }

    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Cap at 50 batches per bulk operation
    const batchIds = body.batchIds.slice(0, 50);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const batchId of batchIds) {
      try {
        const batch = await db.batch.findFirst({
          where: { id: batchId, businessId },
          include: { product: { select: { id: true, name: true, unit: true } } },
        });

        if (!batch) {
          results.push({ batchId, success: false, error: "Batch not found" });
          failureCount++;
          continue;
        }

        switch (body.action) {
          case "quarantine": {
            if (batch.status === "quarantined") {
              results.push({ batchId, success: false, error: "Already quarantined" });
              failureCount++;
              continue;
            }
            if (batch.quantity <= 0) {
              results.push({ batchId, success: false, error: "Zero quantity" });
              failureCount++;
              continue;
            }
            const previousStatus = batch.status;
            await db.batch.update({
              where: { id: batchId },
              data: { status: "quarantined" },
            });
            await db.transaction.create({
              data: {
                businessId,
                productId: batch.productId,
                batchId,
                type: "QUARANTINE",
                quantity: batch.quantity,
                note: `Bulk quarantine: ${body.reason || "unspecified"}${body.notes ? ` — ${body.notes}` : ""} (was ${previousStatus})`,
              },
            });
            results.push({ batchId, success: true, batchNo: batch.batchNo, productName: batch.product.name });
            successCount++;
            break;
          }

          case "dispose": {
            if (batch.quantity <= 0) {
              results.push({ batchId, success: false, error: "Zero quantity" });
              failureCount++;
              continue;
            }
            const valueLost = (batch.mrp || batch.purchasePrice || 0) * batch.quantity;
            const isFullDisposal = true; // bulk dispose always full
            await db.batch.update({
              where: { id: batchId },
              data: {
                quantity: 0,
                status: "destroyed",
              },
            });
            await db.inventory.updateMany({
              where: { productId: batch.productId },
              data: { quantity: { decrement: batch.quantity } },
            });
            await db.transaction.create({
              data: {
                businessId,
                productId: batch.productId,
                batchId,
                type: "WASTE",
                quantity: batch.quantity,
                unitPrice: batch.mrp || batch.purchasePrice,
                note: `Bulk disposal: ${batch.quantity} ${batch.product.unit} | Reason: ${body.reason || "unspecified"} | Method: ${body.disposalMethod || "unspecified"}${body.witness ? ` | Witness: ${body.witness}` : ""}${body.notes ? ` | Notes: ${body.notes}` : ""} | Value lost: ৳${valueLost.toFixed(2)}`,
              },
            });
            results.push({
              batchId,
              success: true,
              batchNo: batch.batchNo,
              productName: batch.product.name,
              valueLost,
            });
            successCount++;
            break;
          }

          case "return_to_supplier": {
            if (batch.quantity <= 0) {
              results.push({ batchId, success: false, error: "Zero quantity" });
              failureCount++;
              continue;
            }
            // Mark as returned (use "returned" status) and zero out
            await db.batch.update({
              where: { id: batchId },
              data: {
                quantity: 0,
                status: "returned",
              },
            });
            await db.inventory.updateMany({
              where: { productId: batch.productId },
              data: { quantity: { decrement: batch.quantity } },
            });
            await db.transaction.create({
              data: {
                businessId,
                productId: batch.productId,
                batchId,
                type: "RETURN",
                quantity: batch.quantity,
                unitPrice: batch.mrp || batch.purchasePrice,
                note: `Bulk return to supplier${body.supplierName ? `: ${body.supplierName}` : ""}${body.notes ? ` — ${body.notes}` : ""}`,
              },
            });
            results.push({
              batchId,
              success: true,
              batchNo: batch.batchNo,
              productName: batch.product.name,
              supplier: body.supplierName,
            });
            successCount++;
            break;
          }

          case "release": {
            if (batch.status !== "quarantined") {
              results.push({ batchId, success: false, error: "Not quarantined" });
              failureCount++;
              continue;
            }
            const newStatus = calculateBatchStatus(batch.expiryDate);
            await db.batch.update({
              where: { id: batchId },
              data: { status: newStatus },
            });
            await db.transaction.create({
              data: {
                businessId,
                productId: batch.productId,
                batchId,
                type: "RELEASE",
                quantity: batch.quantity,
                note: `Bulk release from quarantine → ${newStatus}`,
              },
            });
            results.push({ batchId, success: true, batchNo: batch.batchNo, newStatus });
            successCount++;
            break;
          }

          case "delete": {
            // Decrement inventory
            await db.inventory.updateMany({
              where: { productId: batch.productId },
              data: { quantity: { decrement: batch.quantity } },
            });
            await db.transaction.create({
              data: {
                businessId,
                productId: batch.productId,
                batchId,
                type: "ADJUSTMENT",
                quantity: -batch.quantity,
                note: `Bulk delete: Batch ${batch.batchNo} (${batch.quantity} ${batch.product.unit})`,
              },
            });
            await db.batch.delete({ where: { id: batchId } });
            results.push({ batchId, success: true, batchNo: batch.batchNo });
            successCount++;
            break;
          }
        }
      } catch (err) {
        console.error(`Bulk action error for batch ${batchId}:`, err);
        results.push({ batchId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        failureCount++;
      }
    }

    return NextResponse.json({
      success: failureCount === 0,
      action: body.action,
      summary: {
        total: batchIds.length,
        success: successCount,
        failures: failureCount,
      },
      results,
    });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json({ error: "Failed to perform bulk action" }, { status: 500 });
  }
}
