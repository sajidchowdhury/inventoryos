// GET/POST /api/businesses/[id]/cctv/sales
// POST: Create sale + mark serials as SOLD + update stock + record payment
// PHASE 1: Wrapped in $transaction() for atomic safety
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

  // Calculate subtotal (sum of sell price * qty per item)
  let subtotal = 0;
  for (const item of body.items) {
    subtotal += (item.sellPrice || 0) * (item.quantity || 1);
  }

  // Apply invoice-level discount (if provided)
  const invoiceDiscount = body.invoiceDiscount || 0;
  const totalAmount = Math.max(0, subtotal - invoiceDiscount);

  const paidAmount = body.paidAmount !== undefined ? body.paidAmount : totalAmount;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  try {
    // ── PHASE 1: All operations in a single transaction ──
    // If ANY step fails, ALL changes roll back. No partial sales.
    const sale = await db.$transaction(async (tx) => {
      // 1. Create sale record
      const createdSale = await tx.cCTVSale.create({
        data: {
          businessId,
          customerId: body.customerId || null,
          customerName: body.customerName || null,
          invoiceNo: body.invoiceNo || null,
          subtotal,
          discount: invoiceDiscount,
          totalAmount,
          paidAmount,
          dueAmount,
          paymentType: body.paymentType || (dueAmount > 0 ? "credit" : "cash"),
          saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
          notes: body.notes || null,
        },
      });

      // 2. Create sale items + process serials + update stock
      for (const item of body.items) {
        await tx.cCTVSaleItem.create({
          data: {
            saleId: createdSale.id,
            businessId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity || 1,
            sellPrice: item.sellPrice || 0,
            costPrice: item.costPrice || 0,
            discount: item.discount || 0,
            serialNumber: item.serialNumber || null,
          },
        });

        // If this is a serial-tracked item (has serialNumber), mark it as SOLD
        if (item.serialNumber) {
          // Find the serial item (must be IN_STOCK — atomic check)
          const serialItem = await tx.cCTVSerialItem.findFirst({
            where: { businessId, serialNumber: item.serialNumber, status: "IN_STOCK" },
          });

          if (!serialItem) {
            throw new Error(`Serial ${item.serialNumber} is not in stock or already sold`);
          }

          // Determine warranty months
          let warrantyMonths = item.warrantyMonths || 0;
          if (!warrantyMonths && serialItem.warrantyMonths) {
            warrantyMonths = serialItem.warrantyMonths;
          }
          if (!warrantyMonths) {
            const product = await tx.cCTVProduct.findUnique({
              where: { id: item.productId },
              select: { warrantyMonths: true },
            });
            warrantyMonths = product?.warrantyMonths || 0;
          }
          const warrantyEnd = warrantyMonths > 0
            ? new Date(Date.now() + warrantyMonths * 30 * 24 * 60 * 60 * 1000)
            : null;

          // Mark serial as SOLD
          await tx.cCTVSerialItem.update({
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

          // Create history entry INSIDE transaction (no try/catch — if this fails, sale rolls back)
          await tx.cCTVSerialHistory.create({
            data: {
              businessId,
              serialItemId: serialItem.id,
              serialNumber: item.serialNumber,
              productId: item.productId,
              productName: item.productName,
              eventType: "SOLD",
              description: `Sold to ${body.customerName || "walk-in customer"}${warrantyMonths > 0 ? ` · ${warrantyMonths}m warranty` : ""}`,
              referenceId: createdSale.id,
              referenceType: "sale",
              eventDate: new Date(),
            },
          });
        } else {
          // Non-serial product: ATOMIC stock check + decrement
          // This prevents race conditions — the WHERE clause ensures we only
          // decrement if there's enough stock. If 0 rows updated, stock was insufficient.
          const updated = await tx.cCTVProduct.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity || 1 },
            },
            data: { stock: { decrement: item.quantity || 1 } },
          });

          if (updated.count === 0) {
            // Stock was insufficient — fetch current stock for error message
            const product = await tx.cCTVProduct.findUnique({
              where: { id: item.productId },
              select: { name: true, stock: true },
            });
            throw new Error(
              `Insufficient stock for ${product?.name || item.productId}. Available: ${product?.stock || 0}, requested: ${item.quantity || 1}`
            );
          }
        }
      }

      // 3. Record payment if paid
      if (paidAmount > 0) {
        await tx.cCTVPayment.create({
          data: {
            businessId,
            type: "sale",
            referenceId: createdSale.id,
            customerId: body.customerId || null,
            amount: paidAmount,
            paymentMethod: body.paymentMethod || "cash",
            paymentDate: new Date(),
            notes: `Payment for sale ${createdSale.id}`,
          },
        });
      }

      return createdSale;
    });

    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (err: any) {
    // Transaction failed — ALL changes were rolled back
    console.error("[cctv/sales] Transaction failed:", err);
    const msg = err?.message || "Failed to create sale";
    const status = msg.includes("Insufficient stock") || msg.includes("not in stock") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
