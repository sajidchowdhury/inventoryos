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

  try {

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

      // Get product name for history
      const product = await db.cCTVProduct.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });

      // Create serial items + history entries
      for (const serial of serials) {
        const serialItem = await db.cCTVSerialItem.create({
          data: {
            businessId,
            productId: item.productId,
            serialNumber: serial,
            status: "IN_STOCK",
            costPrice: item.costPrice || 0,
            purchaseDate: new Date(),
          },
        });

        // Create history entry (best-effort — don't block purchase if history table missing)
        try {
          await db.cCTVSerialHistory.create({
            data: {
              businessId,
              serialItemId: serialItem.id,
              serialNumber: serial,
              productId: item.productId,
              productName: product?.name || null,
              eventType: "PURCHASED",
              description: `Purchased from ${body.supplierName || "unknown supplier"}${body.invoiceNo ? ` (Invoice: ${body.invoiceNo})` : ""}`,
              referenceId: purchase.id,
              referenceType: "purchase",
              eventDate: new Date(),
            },
          });
        } catch (historyErr) {
          console.error("[cctv/purchases] History write failed (run `bunx prisma db push` to create cctv_serial_history table):", historyErr);
        }
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
  } catch (err: any) {
    console.error("[cctv/purchases] POST error:", err);
    const msg = err?.message || "Failed to save purchase";
    // Prisma table-not-found error → helpful hint
    if (msg.includes("does not exist") || msg.includes("relation") || err?.code === "P2021") {
      return NextResponse.json({
        error: "Database table missing. Run `bunx prisma db push` on the server to create the new tables (cctv_serial_history, cctv_repairs, cctv_supplier_replacements).",
        detail: msg,
      }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
