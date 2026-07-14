// POST /api/businesses/[id]/cctv/purchases
// One-screen purchase: supplier + items (with bulk serials) + auto stock update
// PHASE 1: Wrapped in $transaction() for atomic safety
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeDecimals } from "@/lib/decimal-serializer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const purchases = await db.cCTVPurchase.findMany({
    where: { businessId },
    include: { items: true, supplier: { select: { id: true, name: true } } },
    orderBy: { purchaseDate: "desc" },
    take: 50,
  });
  return NextResponse.json({ success: true, purchases: serializeDecimals(purchases) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one product is required" }, { status: 400 });
  }

  try {
    // ── PHASE 1: All operations in a single transaction ──
    const purchase = await db.$transaction(async (tx) => {
      // Calculate total
      let totalAmount = 0;
      for (const item of body.items) {
        totalAmount += (item.costPrice || 0) * (item.quantity || 1);
      }

      // 1. Create purchase record
      const createdPurchase = await tx.cCTVPurchase.create({
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

      // 2. Create items + serials + update stock
      for (const item of body.items) {
        // Create purchase item
        await tx.cCTVPurchaseItem.create({
          data: {
            purchaseId: createdPurchase.id,
            businessId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity || 1,
            costPrice: item.costPrice || 0,
            sellPrice: item.sellPrice != null ? parseFloat(item.sellPrice) : 0,
            serialNumbers: item.serialNumbers || null,
            warrantyMonths: item.warrantyMonths != null ? parseInt(item.warrantyMonths) : null,
          },
        });

        // Update product's cost/sell price
        if (item.sellPrice != null && parseFloat(item.sellPrice) > 0) {
          await tx.cCTVProduct.update({
            where: { id: item.productId },
            data: {
              costPrice: item.costPrice || 0,
              sellPrice: parseFloat(item.sellPrice),
            },
          });
        } else {
          await tx.cCTVProduct.update({
            where: { id: item.productId },
            data: { costPrice: item.costPrice || 0 },
          });
        }

        // Parse serial numbers (newline or comma separated)
        if (item.serialNumbers && item.serialNumbers.trim()) {
          const serials = item.serialNumbers
            .split(/[\n,]/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);

          // Get product name + default warranty
          const product = await tx.cCTVProduct.findUnique({
            where: { id: item.productId },
            select: { name: true, warrantyMonths: true },
          });

          const warrantyMonths = item.warrantyMonths != null
            ? parseInt(item.warrantyMonths)
            : (product?.warrantyMonths || 0);

          // Create serial items + history entries (INSIDE transaction — no try/catch)
          for (const serial of serials) {
            const serialItem = await tx.cCTVSerialItem.create({
              data: {
                businessId,
                productId: item.productId,
                serialNumber: serial,
                status: "IN_STOCK",
                costPrice: item.costPrice || 0,
                purchaseDate: new Date(),
                warrantyMonths: warrantyMonths || null,
              },
            });

            // History entry inside transaction
            await tx.cCTVSerialHistory.create({
              data: {
                businessId,
                serialItemId: serialItem.id,
                serialNumber: serial,
                productId: item.productId,
                productName: product?.name || null,
                eventType: "PURCHASED",
                description: `Purchased from ${body.supplierName || "unknown supplier"}${body.invoiceNo ? ` (Invoice: ${body.invoiceNo})` : ""}`,
                referenceId: createdPurchase.id,
                referenceType: "purchase",
                eventDate: new Date(),
              },
            });
          }

          // Update product stock by serial count
          await tx.cCTVProduct.update({
            where: { id: item.productId },
            data: { stock: { increment: serials.length } },
          });
        } else {
          // Non-serial product: increment stock
          await tx.cCTVProduct.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity || 1 } },
          });
        }
      }

      // 3. Record payment if paid
      if (body.paidAmount && body.paidAmount > 0) {
        await tx.cCTVPayment.create({
          data: {
            businessId,
            type: "purchase",
            referenceId: createdPurchase.id,
            supplierId: body.supplierId || null,
            amount: body.paidAmount,
            paymentMethod: body.paymentMethod || "cash",
            paymentDate: new Date(),
            notes: `Payment for purchase ${createdPurchase.id}`,
          },
        });
      }

      return createdPurchase;
    });

    return NextResponse.json({ success: true, purchase }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/purchases] Transaction failed:", err);
    const msg = err?.message || "Failed to save purchase";

    // Handle unique constraint violations (P2002)
    if (err?.code === "P2002") {
      const target = err?.meta?.target as string[] | undefined;
      if (target?.includes("serialNumber")) {
        return NextResponse.json({ error: "One or more serial numbers already exist in this business. Duplicate serials are not allowed." }, { status: 400 });
      }
      return NextResponse.json({ error: "Duplicate entry — this record already exists." }, { status: 400 });
    }

    if (msg.includes("does not exist") || msg.includes("relation") || err?.code === "P2021") {
      return NextResponse.json({
        error: "Database table missing. Run `bunx prisma db push` on the server to create the new tables.",
        detail: msg,
      }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
