// GET /api/businesses/[id]/cctv/supplier-replacements?status=xxx
// POST /api/businesses/[id]/cctv/supplier-replacements — create replacement request (send to supplier)
// PHASE 1: Wrapped in $transaction() for atomic safety
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { businessId };
  if (status) where.status = status;

  const replacements = await db.cCTVSupplierReplacement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, replacements });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  const isSerialMode = !!body.originalSerialNumber;

  try {
    // ── PHASE 1: All operations in a single transaction ──
    const replacement = await db.$transaction(async (tx) => {
      let originalSerial = null;
      let productId = body.productId || null;
      let productName = body.productName || null;

      if (isSerialMode) {
        originalSerial = await tx.cCTVSerialItem.findFirst({
          where: { businessId, serialNumber: body.originalSerialNumber },
          include: { product: { select: { id: true, name: true, costPrice: true } } },
        });

        if (!originalSerial && !body.productId) {
          throw new Error("Serial not found and no productId provided");
        }

        productId = originalSerial?.productId || body.productId;
        productName = originalSerial?.product?.name || body.productName;
      } else {
        if (!body.productId) {
          throw new Error("Either originalSerialNumber or productId is required");
        }
        const product = await tx.cCTVProduct.findUnique({
          where: { id: body.productId },
          select: { name: true },
        });
        if (!product) {
          throw new Error("Product not found");
        }
        productName = product.name;
      }

      // Get supplier info
      let supplierName = body.supplierName || null;
      if (body.supplierId) {
        const supplier = await tx.cCTVSupplier.findUnique({ where: { id: body.supplierId } });
        if (supplier) supplierName = supplier.name;
      }

      const quantity = parseInt(body.quantity) || 1;

      // 1. Create replacement record
      const createdReplacement = await tx.cCTVSupplierReplacement.create({
        data: {
          businessId,
          repairId: body.repairId || null,
          supplierId: body.supplierId || null,
          supplierName,
          originalSerialNumber: body.originalSerialNumber || null,
          originalSerialItemId: originalSerial?.id || null,
          newSerialNumber: body.newSerialNumber || null,
          productId: productId || null,
          productName: productName || null,
          quantity,
          isSerialTracked: isSerialMode,
          status: "sent",
          sentDate: body.sentDate ? new Date(body.sentDate) : new Date(),
          notes: body.notes || null,
        },
      });

      // 2. If linked to a repair, update repair status
      if (body.repairId) {
        await tx.cCTVRepair.update({
          where: { id: body.repairId },
          data: {
            status: "sent_to_supplier",
            replacementId: createdReplacement.id,
          },
        });
      }

      // 3. Update serial status or decrement stock
      if (isSerialMode) {
        if (originalSerial) {
          await tx.cCTVSerialItem.update({
            where: { id: originalSerial.id },
            data: { status: "SENT_TO_SUPPLIER" },
          });

          // History entry inside transaction (no try/catch)
          await tx.cCTVSerialHistory.create({
            data: {
              businessId,
              serialItemId: originalSerial.id,
              serialNumber: body.originalSerialNumber,
              productId: originalSerial.productId,
              productName: originalSerial.product?.name || null,
              eventType: "SENT_TO_SUPPLIER",
              description: `Sent to supplier${supplierName ? ` (${supplierName})` : ""} for replacement`,
              referenceId: createdReplacement.id,
              referenceType: "replacement",
              eventDate: new Date(),
            },
          });
        }
      } else {
        // Non-serial: ATOMIC stock check + decrement
        const updated = await tx.cCTVProduct.updateMany({
          where: { id: productId!, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });

        if (updated.count === 0) {
          const product = await tx.cCTVProduct.findUnique({
            where: { id: productId! },
            select: { name: true, stock: true },
          });
          throw new Error(
            `Insufficient stock for ${product?.name || productId}. Available: ${product?.stock || 0}, needed: ${quantity}`
          );
        }
      }

      return createdReplacement;
    });

    return NextResponse.json({ success: true, replacement }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/supplier-replacements] Transaction failed:", err);
    const msg = err?.message || "Failed to create replacement";
    const status = msg.includes("Insufficient stock") || msg.includes("not found") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
