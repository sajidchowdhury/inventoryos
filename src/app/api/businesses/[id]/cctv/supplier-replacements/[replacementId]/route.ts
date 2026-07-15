// PATCH /api/businesses/[id]/cctv/supplier-replacements/[replacementId]
// Receive replacement: enter new serial number, mark old as REPLACED, create new serial item
// PHASE 1: Wrapped in $transaction() for atomic safety
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; replacementId: string }> }) {
  const { id: businessId, replacementId } = await params;
  const body = await req.json();

  const replacement = await db.cCTVSupplierReplacement.findFirst({
    where: { id: replacementId, businessId },
  });

  if (!replacement) {
    return NextResponse.json({ error: "Replacement not found" }, { status: 404 });
  }

  // Receiving replacement — ALWAYS requires new serial number
  if (body.newSerialNumber && replacement.status !== "received") {
    try {
      // ── PHASE 1: All operations in a single transaction ──
      const result = await db.$transaction(async (tx) => {
        // Check if new serial already exists
        const existing = await tx.cCTVSerialItem.findFirst({
          where: { businessId, serialNumber: body.newSerialNumber },
        });
        if (existing) {
          throw new Error(`Serial ${body.newSerialNumber} already exists in the system`);
        }

        // Get original serial for cost/price inheritance
        const originalSerial = replacement.originalSerialItemId
          ? await tx.cCTVSerialItem.findUnique({
              where: { id: replacement.originalSerialItemId },
            })
          : null;

        // Get product for cost/price (non-serial mode)
        const product = replacement.productId
          ? await tx.cCTVProduct.findUnique({
              where: { id: replacement.productId },
              select: { costPrice: true, sellPrice: true },
            })
          : null;

        // 1. Create the new serial item
        const newSerialItem = await tx.cCTVSerialItem.create({
          data: {
            businessId,
            productId: replacement.productId || originalSerial?.productId || body.productId,
            serialNumber: body.newSerialNumber,
            status: "IN_STOCK",
            costPrice: originalSerial?.costPrice || product?.costPrice || 0,
            sellPrice: originalSerial?.sellPrice || product?.sellPrice || null,
            purchaseDate: new Date(),
            warrantyEnd: null,
            replacesSerialId: replacement.originalSerialItemId,
          },
        });

        // 2. Update replacement record
        const updated = await tx.cCTVSupplierReplacement.update({
          where: { id: replacementId },
          data: {
            status: "received",
            newSerialNumber: body.newSerialNumber,
            newSerialItemId: newSerialItem.id,
            receivedDate: new Date(),
            notes: body.notes ? `${replacement.notes || ""}\n${body.notes}`.trim() : replacement.notes,
          },
        });

        // 3. Mark old serial as REPLACED (if serial-tracked)
        if (replacement.originalSerialItemId) {
          await tx.cCTVSerialItem.update({
            where: { id: replacement.originalSerialItemId },
            data: { status: "REPLACED" },
          });
        }

        // 4. For non-serial mode: increment product stock + create movement
        if (replacement.isSerialTracked === false && replacement.productId) {
          await tx.cCTVProduct.update({
            where: { id: replacement.productId },
            data: { stock: { increment: replacement.quantity } },
          });

          // Stock movement audit record (replacement received)
          const prodAfter = await tx.cCTVProduct.findUnique({
            where: { id: replacement.productId },
            select: { stock: true },
          });
          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId: replacement.productId,
              productName: replacement.productName,
              movementType: "REPLACEMENT_RECEIVE",
              quantityChange: replacement.quantity,
              balanceAfter: prodAfter?.stock || 0,
              referenceId: replacementId,
              referenceType: "replacement",
              notes: `Received ${replacement.quantity} replacement items from supplier`,
            },
          });
        }

        // 5. Create history entries (INSIDE transaction — no try/catch)
        if (replacement.originalSerialItemId) {
          await tx.cCTVSerialHistory.create({
            data: {
              businessId,
              serialItemId: replacement.originalSerialItemId,
              serialNumber: replacement.originalSerialNumber || "",
              productId: replacement.productId,
              productName: replacement.productName,
              eventType: "REPLACED",
              description: `Replaced by supplier — new serial: ${body.newSerialNumber}`,
              referenceId: replacementId,
              referenceType: "replacement",
              eventDate: new Date(),
            },
          });
        }

        await tx.cCTVSerialHistory.create({
          data: {
            businessId,
            serialItemId: newSerialItem.id,
            serialNumber: body.newSerialNumber,
            productId: replacement.productId,
            productName: replacement.productName,
            eventType: "REPLACEMENT_RECEIVED",
            description: replacement.originalSerialNumber
              ? `Received as replacement for ${replacement.originalSerialNumber}`
              : `Received as replacement for ${replacement.productName} (in-stock damaged)`,
            referenceId: replacementId,
            referenceType: "replacement",
            eventDate: new Date(),
          },
        });

        // 6. If linked to repair, mark repair as replaced
        if (replacement.repairId) {
          await tx.cCTVRepair.update({
            where: { id: replacement.repairId },
            data: { status: "replaced" },
          });
        }

        return { updated, newSerialItem };
      });

      return NextResponse.json({ success: true, replacement: result.updated, newSerialItem: result.newSerialItem });
    } catch (err: any) {
      console.error("[cctv/supplier-replacements] Transaction failed:", err);
      const msg = err?.message || "Failed to receive replacement";
      const status = msg.includes("already exists") ? 400 : 500;
      return NextResponse.json({ error: msg }, { status });
    }
  }

  // Generic update (e.g. cancel)
  const updateData: Record<string, unknown> = {};
  if (body.status) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const updated = await db.cCTVSupplierReplacement.update({
    where: { id: replacementId },
    data: updateData,
  });

  return NextResponse.json({ success: true, replacement: updated });
}
