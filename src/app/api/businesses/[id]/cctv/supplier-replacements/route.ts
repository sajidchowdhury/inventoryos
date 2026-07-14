// GET /api/businesses/[id]/cctv/supplier-replacements?status=xxx
// POST /api/businesses/[id]/cctv/supplier-replacements — create replacement request (send to supplier)
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

  // Two modes: serial-tracked (has originalSerialNumber) or non-serial (has productId + quantity)
  const isSerialMode = !!body.originalSerialNumber;

  let originalSerial = null;
  let productId = body.productId || null;
  let productName = body.productName || null;

  if (isSerialMode) {
    // Serial-tracked flow: look up the serial item
    originalSerial = await db.cCTVSerialItem.findFirst({
      where: { businessId, serialNumber: body.originalSerialNumber },
      include: { product: { select: { id: true, name: true, costPrice: true } } },
    });

    if (!originalSerial && !body.productId) {
      return NextResponse.json({ error: "Serial not found and no productId provided" }, { status: 400 });
    }

    productId = originalSerial?.productId || body.productId;
    productName = originalSerial?.product?.name || body.productName;
  } else {
    // Non-serial flow: must have productId
    if (!body.productId) {
      return NextResponse.json({ error: "Either originalSerialNumber or productId is required" }, { status: 400 });
    }
    // Look up product to get name
    const product = await db.cCTVProduct.findUnique({
      where: { id: body.productId },
      select: { name: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    productName = product.name;
  }

  // Get supplier info if provided
  let supplierName = body.supplierName || null;
  if (body.supplierId) {
    const supplier = await db.cCTVSupplier.findUnique({ where: { id: body.supplierId } });
    if (supplier) supplierName = supplier.name;
  }

  const quantity = parseInt(body.quantity) || 1;

  // Create replacement record
  const replacement = await db.cCTVSupplierReplacement.create({
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

  // If linked to a repair, update repair status + replacementId
  if (body.repairId) {
    await db.cCTVRepair.update({
      where: { id: body.repairId },
      data: {
        status: "sent_to_supplier",
        replacementId: replacement.id,
      },
    });
  }

  if (isSerialMode) {
    // Serial flow: update original serial status to SENT_TO_SUPPLIER
    if (originalSerial) {
      await db.cCTVSerialItem.update({
        where: { id: originalSerial.id },
        data: { status: "SENT_TO_SUPPLIER" },
      });

      // Create history entry (best-effort)
      try {
        await db.cCTVSerialHistory.create({
          data: {
            businessId,
            serialItemId: originalSerial.id,
            serialNumber: body.originalSerialNumber,
            productId: originalSerial.productId,
            productName: originalSerial.product?.name || null,
            eventType: "SENT_TO_SUPPLIER",
            description: `Sent to supplier${supplierName ? ` (${supplierName})` : ""} for replacement`,
            referenceId: replacement.id,
            referenceType: "replacement",
            eventDate: new Date(),
          },
        });
      } catch (historyErr) {
        console.error("[cctv/supplier-replacements] History write failed:", historyErr);
      }
    }
  } else {
    // Non-serial flow: decrement stock (damaged items leaving inventory)
    await db.cCTVProduct.update({
      where: { id: productId! },
      data: { stock: { decrement: quantity } },
    });
  }

  return NextResponse.json({ success: true, replacement }, { status: 201 });
}
