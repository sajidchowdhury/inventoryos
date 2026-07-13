// GET/POST /api/businesses/[id]/cctv/sales
// POST: Create sale + mark serials as SOLD + update stock + record payment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const sales = await db.cCTVSale.findMany({
    where: { businessId },
    include: { items: true },
    orderBy: { saleDate: "desc" },
    take: 50,
  });
  return NextResponse.json({ success: true, sales });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  // Calculate total
  let totalAmount = 0;
  for (const item of body.items) {
    totalAmount += (item.sellPrice || 0) * (item.quantity || 1);
  }

  const paidAmount = body.paidAmount !== undefined ? body.paidAmount : totalAmount;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // Create sale
  const sale = await db.cCTVSale.create({
    data: {
      businessId,
      customerId: body.customerId || null,
      customerName: body.customerName || null,
      invoiceNo: body.invoiceNo || null,
      totalAmount,
      paidAmount,
      dueAmount,
      paymentType: body.paymentType || (dueAmount > 0 ? "credit" : "cash"),
      saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
      notes: body.notes || null,
    },
  });

  // Create sale items + process serials + update stock
  for (const item of body.items) {
    await db.cCTVSaleItem.create({
      data: {
        saleId: sale.id,
        businessId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity || 1,
        sellPrice: item.sellPrice || 0,
        costPrice: item.costPrice || 0,
        serialNumber: item.serialNumber || null,
      },
    });

    // If this is a serial-tracked item (has serialNumber), mark it as SOLD
    if (item.serialNumber) {
      const warrantyMonths = item.warrantyMonths || 0;
      const warrantyEnd = warrantyMonths > 0
        ? new Date(Date.now() + warrantyMonths * 30 * 24 * 60 * 60 * 1000)
        : null;

      // Find the serial item first (to get its ID for history)
      const serialItem = await db.cCTVSerialItem.findFirst({
        where: { businessId, serialNumber: item.serialNumber, status: "IN_STOCK" },
      });

      if (serialItem) {
        await db.cCTVSerialItem.update({
          where: { id: serialItem.id },
          data: {
            status: "SOLD",
            sellPrice: item.sellPrice || 0,
            saleDate: new Date(),
            warrantyEnd,
            customerId: body.customerId || null,
            customerName: body.customerName || null,
          },
        });

        // Create history entry (best-effort — don't block sale if history table missing)
        try {
          await db.cCTVSerialHistory.create({
            data: {
              businessId,
              serialItemId: serialItem.id,
              serialNumber: item.serialNumber,
              productId: item.productId,
              productName: item.productName,
              eventType: "SOLD",
              description: `Sold to ${body.customerName || "walk-in customer"}${warrantyMonths > 0 ? ` · ${warrantyMonths}m warranty` : ""}`,
              referenceId: sale.id,
              referenceType: "sale",
              eventDate: new Date(),
            },
          });
        } catch (historyErr) {
          console.error("[cctv/sales] History write failed (run `bunx prisma db push` to create cctv_serial_history table):", historyErr);
        }
      }
    } else {
      // Non-serial product: decrement stock
      await db.cCTVProduct.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity || 1 } },
      });
    }
  }

  // Record payment if paid
  if (paidAmount > 0) {
    await db.cCTVPayment.create({
      data: {
        businessId,
        type: "sale",
        referenceId: sale.id,
        customerId: body.customerId || null,
        amount: paidAmount,
        paymentMethod: body.paymentMethod || "cash",
        paymentDate: new Date(),
        notes: `Payment for sale ${sale.id}`,
      },
    });
  }

  return NextResponse.json({ success: true, sale }, { status: 201 });
}
