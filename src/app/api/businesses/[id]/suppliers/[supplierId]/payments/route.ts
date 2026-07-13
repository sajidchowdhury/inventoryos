// GET/POST /api/businesses/[id]/suppliers/[supplierId]/payments
// GET: List payments made to this supplier (both Purchase + MSPurchase)
// POST: Record a payment to supplier with FIFO allocation across both models
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: businessId, supplierId } = await params;

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, businessId },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Fetch purchases from both models
    const [generalPurchases, cctvPurchases] = await Promise.all([
      db.purchase.findMany({
        where: { businessId, supplierId, status: { not: "cancelled" } },
        select: {
          id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
          paymentStatus: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.mSPurchase.findMany({
        where: { businessId, supplierId, status: { not: "cancelled" } },
        select: {
          id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
          paymentStatus: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const allPurchases = [
      ...generalPurchases.map((p) => ({ ...p, source: "purchase" as const })),
      ...cctvPurchases.map((p) => ({ ...p, source: "mobile-shop" as const })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Summary
    const summary = {
      totalPurchased: supplier.totalPurchased,
      totalPaid: supplier.totalPaid,
      balance: supplier.balance,
      purchaseCount: allPurchases.length,
      outstandingPurchases: allPurchases.filter((p) => p.paymentStatus !== "paid").length,
      generalPurchases: generalPurchases.length,
      cctvPurchases: cctvPurchases.length,
    };

    return NextResponse.json({
      success: true,
      supplier: { id: supplier.id, name: supplier.name, code: supplier.code },
      summary,
      purchases: allPurchases,
    });
  } catch (error) {
    console.error("Get supplier payments error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: businessId, supplierId } = await params;
    const body = await req.json();

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, businessId, isActive: true },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    if (amount > supplier.balance) {
      return NextResponse.json(
        { error: `Overpayment: supplier balance is ৳${supplier.balance.toFixed(2)}, cannot pay ৳${amount.toFixed(2)}` },
        { status: 400 }
      );
    }

    const paymentMethod = body.method || "cash";
    const paymentReference = body.reference || null;
    const allocationMode = body.purchaseId ? "specific" : "fifo";

    await db.$transaction(async (tx) => {
      if (allocationMode === "specific") {
        // Try to find in both models
        let purchase = await tx.purchase.findFirst({
          where: { id: body.purchaseId, businessId, supplierId, status: { not: "cancelled" } },
        });
        let source: "purchase" | "mobile-shop" = "purchase";

        if (!purchase) {
          purchase = await tx.cCTVPurchase.findFirst({
            where: { id: body.purchaseId, businessId, supplierId, status: { not: "cancelled" } },
          }) as any;
          if (purchase) source = "mobile-shop";
        }

        if (!purchase) {
          throw new Error("Purchase not found for this supplier");
        }

        const newPaid = purchase.paidAmount + amount;
        if (newPaid > purchase.totalAmount) {
          throw new Error(`Overpayment for ${purchase.purchaseNo}: total ৳${purchase.totalAmount}, already paid ৳${purchase.paidAmount}`);
        }

        let paymentStatus = "unpaid";
        if (newPaid >= purchase.totalAmount) paymentStatus = "paid";
        else if (newPaid > 0) paymentStatus = "partial";

        if (source === "purchase") {
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paidAmount: newPaid, paymentStatus },
          });
        } else {
          await tx.cCTVPurchase.update({
            where: { id: purchase.id },
            data: { paidAmount: newPaid, paymentStatus },
          });
        }
      } else {
        // FIFO allocation across both models (oldest first, combined)
        const [generalOutstanding, cctvOutstanding] = await Promise.all([
          tx.purchase.findMany({
            where: { businessId, supplierId, status: { not: "cancelled" }, paymentStatus: { in: ["partial", "unpaid"] } },
            orderBy: { createdAt: "asc" },
            select: { id: true, paidAmount: true, totalAmount: true },
          }),
          tx.cCTVPurchase.findMany({
            where: { businessId, supplierId, status: { not: "cancelled" }, paymentStatus: { in: ["partial", "unpaid"] } },
            orderBy: { createdAt: "asc" },
            select: { id: true, paidAmount: true, totalAmount: true },
          }),
        ]);

        // Merge and sort by creation order (need createdAt for sorting)
        type OutstandingItem = { id: string; paidAmount: number; totalAmount: number; createdAt: Date; source: "purchase" | "mobile-shop" };
        const generalWithDate = await tx.purchase.findMany({
          where: { id: { in: generalOutstanding.map((p) => p.id) } },
          select: { id: true, createdAt: true },
        });
        const cctvWithDate = await tx.cCTVPurchase.findMany({
          where: { id: { in: cctvOutstanding.map((p) => p.id) } },
          select: { id: true, createdAt: true },
        });

        const generalMap = new Map(generalWithDate.map((p) => [p.id, p.createdAt]));
        const cctvMap = new Map(cctvWithDate.map((p) => [p.id, p.createdAt]));

        const allOutstanding: OutstandingItem[] = [
          ...generalOutstanding.map((p) => ({ ...p, createdAt: generalMap.get(p.id)!, source: "purchase" as const })),
          ...cctvOutstanding.map((p) => ({ ...p, createdAt: cctvMap.get(p.id)!, source: "mobile-shop" as const })),
        ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        let remaining = amount;
        for (const item of allOutstanding) {
          if (remaining <= 0) break;
          const due = item.totalAmount - item.paidAmount;
          const apply = Math.min(due, remaining);

          const newPaid = item.paidAmount + apply;
          let paymentStatus = "partial";
          if (newPaid >= item.totalAmount) paymentStatus = "paid";

          if (item.source === "purchase") {
            await tx.purchase.update({
              where: { id: item.id },
              data: { paidAmount: newPaid, paymentStatus },
            });
          } else {
            await tx.cCTVPurchase.update({
              where: { id: item.id },
              data: { paidAmount: newPaid, paymentStatus },
            });
          }
          remaining -= apply;
        }
      }

      // Update supplier totals
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          balance: { decrement: amount },
          totalPaid: { increment: amount },
        },
      });
    });

    // Fetch updated supplier
    const updatedSupplier = await db.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, balance: true, totalPaid: true, totalPurchased: true },
    });

    return NextResponse.json({
      success: true,
      supplier: updatedSupplier,
      payment: {
        amount,
        method: paymentMethod,
        reference: paymentReference,
        purchaseId: body.purchaseId || null,
        allocationMode,
      },
      message: `Payment of ৳${amount.toFixed(2)} recorded. New balance: ৳${updatedSupplier?.balance.toFixed(2)}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Record supplier payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record payment" },
      { status: 500 }
    );
  }
}