// POST /api/businesses/[id]/dispense
// Multi-item dispense using FEFO allocation with optional manual batch override (Gap 11)
//
// Input:
//   { items: [{ productId, quantity, manualBatches?: [{ batchId, quantity, overrideReason? }] }], note? }
//
// If manualBatches is omitted → standard FEFO allocation (auto)
// If manualBatches is provided → use those batches instead of FEFO order
//   - If the first manual batch is NOT the FEFO-first batch → override=true
//   - overrideReason is required (min 10 chars) when override=true
//   - A FefoOverride record is created for audit trail
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

interface ManualBatch {
  batchId: string;
  quantity: number;
  overrideReason?: string;
}

interface DispenseItem {
  productId: string;
  quantity: number;
  manualBatches?: ManualBatch[];
}

interface DispenseResult {
  productId: string;
  productName: string;
  unit: string;
  requested: number;
  allocated: number;
  shortFall: number;
  success: boolean;
  override: boolean;
  overrideReason?: string;
  allocations: Array<{
    batchId: string;
    batchNo: string;
    expiryDate: Date;
    allocated: number;
    override: boolean;
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
    const userId = body.userId || null;
    const userName = body.userName || null;

    // Validate all items first
    for (const item of items) {
      const qty = parseFloat(item.quantity);
      if (!item.productId) {
        return NextResponse.json({ error: "All items must have productId" }, { status: 400 });
      }
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: "All quantities must be positive numbers" }, { status: 400 });
      }
      // Validate manual batch overrides
      if (item.manualBatches && item.manualBatches.length > 0) {
        for (const mb of item.manualBatches) {
          if (!mb.batchId) {
            return NextResponse.json({ error: "manualBatches entries must have batchId" }, { status: 400 });
          }
          if (isNaN(mb.quantity) || mb.quantity <= 0) {
            return NextResponse.json({ error: "manualBatches quantities must be positive" }, { status: 400 });
          }
        }
      }
    }

    const results: DispenseResult[] = [];
    let totalSuccess = 0;
    let totalFailures = 0;
    let totalValue = 0;
    let totalOverrides = 0;

    // Process each item
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
          override: false,
          allocations: [],
          error: "Product not found",
        });
        totalFailures++;
        continue;
      }

      // Fetch all available batches in FEFO order
      const allBatches = await db.batch.findMany({
        where: {
          businessId,
          productId: item.productId,
          quantity: { gt: 0 },
          status: { in: ["active", "near_expiry"] },
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      });

      if (allBatches.length === 0) {
        results.push({
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          requested: requestedQty,
          allocated: 0,
          shortFall: requestedQty,
          success: false,
          override: false,
          allocations: [],
          error: "No available stock",
        });
        totalFailures++;
        continue;
      }

      // ── Determine allocation: manual or FEFO ──
      let allocations: Array<{ batchId: string; batchNo: string; expiryDate: Date; allocated: number; override: boolean }> = [];
      let isOverride = false;
      let overrideReason: string | undefined;

      if (item.manualBatches && item.manualBatches.length > 0) {
        // ── Manual batch selection (Gap 11) ──
        // Check if the first manual batch is NOT the FEFO-first batch
        const fefoFirstBatchId = allBatches[0]?.id;
        const firstManualBatchId = item.manualBatches[0]?.batchId;

        if (firstManualBatchId !== fefoFirstBatchId) {
          // This is an override — require a reason
          isOverride = true;
          overrideReason = item.manualBatches[0]?.overrideReason;
          if (!overrideReason || overrideReason.trim().length < 10) {
            results.push({
              productId: product.id,
              productName: product.name,
              unit: product.unit,
              requested: requestedQty,
              allocated: 0,
              shortFall: requestedQty,
              success: false,
              override: true,
              allocations: [],
              error: "Override reason required (min 10 characters) when not using FEFO order",
            });
            totalFailures++;
            continue;
          }
        }

        // Build allocations from manual selections
        for (const mb of item.manualBatches) {
          const batch = allBatches.find(b => b.id === mb.batchId);
          if (!batch) {
            // Try to find it even if it's not in the FEFO list (e.g., quarantined but staff override)
            const anyBatch = await db.batch.findFirst({
              where: { id: mb.batchId, businessId, productId: item.productId },
            });
            if (!anyBatch) {
              results.push({
                productId: product.id,
                productName: product.name,
                unit: product.unit,
                requested: requestedQty,
                allocated: 0,
                shortFall: requestedQty,
                success: false,
                override: isOverride,
                allocations: [],
                error: `Batch ${mb.batchId} not found for product ${product.name}`,
              });
              totalFailures++;
              continue;
            }
            allocations.push({
              batchId: anyBatch.id,
              batchNo: anyBatch.batchNo,
              expiryDate: anyBatch.expiryDate,
              allocated: mb.quantity,
              override: isOverride,
            });
          } else {
            allocations.push({
              batchId: batch.id,
              batchNo: batch.batchNo,
              expiryDate: batch.expiryDate,
              allocated: mb.quantity,
              override: isOverride,
            });
          }
        }
      } else {
        // ── Standard FEFO allocation ──
        let remaining = requestedQty;
        for (const batch of allBatches) {
          if (remaining <= 0) continue;
          const take = Math.min(batch.quantity, remaining);
          allocations.push({
            batchId: batch.id,
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate,
            allocated: take,
            override: false,
          });
          remaining -= take;
        }
      }

      // Calculate totals
      const allocated = allocations.reduce((sum, a) => sum + a.allocated, 0);
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
          override: isOverride,
          overrideReason,
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
            note: `${note} (batch ${alloc.batchNo})${alloc.override ? " [FEFO OVERRIDE]" : ""}`,
          },
        });
      }

      // ── Gap 11: Create FefoOverride audit record ──
      if (isOverride && overrideReason) {
        const fefoFirstBatch = allBatches[0];
        const selectedBatch = allocations[0];
        await db.fefoOverride.create({
          data: {
            businessId,
            productId: product.id,
            productName: product.name,
            selectedBatchId: selectedBatch.batchId,
            selectedBatchNo: selectedBatch.batchNo,
            expectedBatchId: fefoFirstBatch?.id || "",
            expectedBatchNo: fefoFirstBatch?.batchNo || "",
            userId,
            userName,
            reason: overrideReason,
          },
        });
        totalOverrides++;
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
        override: isOverride,
        overrideReason,
        allocations,
      });
      totalSuccess++;
    }

    const allSuccess = totalFailures === 0;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? `Dispensed ${totalSuccess} item(s) successfully${totalOverrides > 0 ? ` (${totalOverrides} FEFO override${totalOverrides > 1 ? "s" : ""})` : ""}`
        : `${totalSuccess} succeeded, ${totalFailures} failed`,
      summary: {
        totalItems: items.length,
        success: totalSuccess,
        failures: totalFailures,
        totalValue,
        totalOverrides,
      },
      results,
    });
  } catch (error) {
    console.error("Quick dispense error:", error);
    return NextResponse.json({ error: "Failed to dispense" }, { status: 500 });
  }
}
