// POST /api/businesses/[id]/cctv/purchases
// One-screen purchase: supplier + items (with bulk serials) + auto stock update
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const purchases = await db.cCTVPurchase.findMany({
    where: { businessId },
    include: { items: true, supplier: { select: { id: true, name: true } } },
    orderBy: { purchaseDate: "desc" },
    take: 50,
  });
  return NextResponse.json({ success: true, purchases });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one product is required" }, { status: 400 });
  }

  // Calculate total
  let totalAmount = 0;
  for (const item of body.items) {
    totalAmount += (item.costPrice || 0) * (item.quantity || 1);
  }

  // Create purchase
  const purchase = await db.cCTVPurchase.create({
    data: {
      businessId,
      supplierId: body.supplierId || null,
      supplierName: body.supplierName || null,
      invoiceNo: body.invoiceNo || null,
      totalAmount,
      paidAmount: body.paidAmount || totalAmount,
      dueAmount: (body.paidAmount || totalAmount) - totalAmount < 0 ? Math.abs((body.paidAmount || totalAmount) - totalAmount) : 0,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
      notes: body.notes || null,
    },
  });

  // Create items + serials + update stock
  for (const item of body.items) {
    // Create purchase item
    await db.cCTVPurchaseItem.create({
      data: {
        purchaseId: purchase.id,
        businessId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity || 1,
        costPrice: item.costPrice || 0,
        serialNumbers: item.serialNumbers || null,
      },
    });

    // Parse serial numbers (newline or comma separated)
    if (item.serialNumbers && item.serialNumbers.trim()) {
      const serials = item.serialNumbers
        .split(/[\n,]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      // Create serial items
      for (const serial of serials) {
        await db.cCTVSerialItem.create({
          data: {
            businessId,
            productId: item.productId,
            serialNumber: serial,
            status: "IN_STOCK",
            costPrice: item.costPrice || 0,
            purchaseDate: new Date(),
          },
        });
      }

      // Update product stock by serial count
      await db.cCTVProduct.update({
        where: { id: item.productId },
        data: { stock: { increment: serials.length } },
      });
    } else {
      // Non-serial product: just update stock
      await db.cCTVProduct.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity || 1 },
          costPrice: item.costPrice || 0, // Update cost price to latest
        },
      });
    }
  }

  // Record payment if paid
  if (body.paidAmount && body.paidAmount > 0) {
    await db.cCTVPayment.create({
      data: {
        businessId,
        type: "purchase",
        referenceId: purchase.id,
        supplierId: body.supplierId || null,
        amount: body.paidAmount,
        paymentMethod: body.paymentMethod || "cash",
        paymentDate: new Date(),
        notes: `Payment for purchase ${purchase.id}`,
      },
    });
  }

  return NextResponse.json({ success: true, purchase }, { status: 201 });
}
