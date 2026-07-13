// PATCH /api/businesses/[id]/cctv/supplier-replacements/[replacementId]
// Receive replacement: enter new serial number, mark old as REPLACED, create new serial item
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

  // If we're receiving the replacement (new serial provided)
  if (body.newSerialNumber && replacement.status !== "received") {
    // Check if new serial already exists
    const existing = await db.cCTVSerialItem.findFirst({
      where: { businessId, serialNumber: body.newSerialNumber },
    });
    if (existing) {
      return NextResponse.json({
        error: `Serial ${body.newSerialNumber} already exists in the system`,
      }, { status: 400 });
    }

    // Create the new serial item — inherits cost/price/warranty from original
    const originalSerial = replacement.originalSerialItemId
      ? await db.cCTVSerialItem.findUnique({
          where: { id: replacement.originalSerialItemId },
        })
      : null;

    const newSerialItem = await db.cCTVSerialItem.create({
      data: {
        businessId,
        productId: replacement.productId || originalSerial?.productId || body.productId,
        serialNumber: body.newSerialNumber,
        status: "IN_STOCK", // ready to be given to customer or sold
        costPrice: originalSerial?.costPrice || 0,
        sellPrice: originalSerial?.sellPrice,
        purchaseDate: new Date(),
        warrantyEnd: null, // warranty resets on replacement
        replacesSerialId: replacement.originalSerialItemId,
      },
    });

    // Update replacement record
    const updated = await db.cCTVSupplierReplacement.update({
      where: { id: replacementId },
      data: {
        status: "received",
        newSerialNumber: body.newSerialNumber,
        newSerialItemId: newSerialItem.id,
        receivedDate: new Date(),
        notes: body.notes ? `${replacement.notes || ""}\n${body.notes}`.trim() : replacement.notes,
      },
    });

    // Mark old serial as REPLACED
    if (replacement.originalSerialItemId) {
      await db.cCTVSerialItem.update({
        where: { id: replacement.originalSerialItemId },
        data: { status: "REPLACED" },
      });
    }

    // Create history entries for both old and new serials
    if (replacement.originalSerialItemId) {
      await db.cCTVSerialHistory.create({
        data: {
          businessId,
          serialItemId: replacement.originalSerialItemId,
          serialNumber: replacement.originalSerialNumber,
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

    await db.cCTVSerialHistory.create({
      data: {
        businessId,
        serialItemId: newSerialItem.id,
        serialNumber: body.newSerialNumber,
        productId: replacement.productId,
        productName: replacement.productName,
        eventType: "REPLACEMENT_RECEIVED",
        description: `Received as replacement for ${replacement.originalSerialNumber}`,
        referenceId: replacementId,
        referenceType: "replacement",
        eventDate: new Date(),
      },
    });

    // If linked to repair, mark repair as replaced
    if (replacement.repairId) {
      await db.cCTVRepair.update({
        where: { id: replacement.repairId },
        data: { status: "replaced" },
      });
    }

    return NextResponse.json({ success: true, replacement: updated, newSerialItem });
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
