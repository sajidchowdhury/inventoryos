// GET/POST /api/businesses/[id]/suppliers/[supplierId]/payments
// GET: List payments made to this supplier
// POST: Record a payment to supplier (reduces balance)
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

    // Fetch purchases with payments for this supplier
    const purchases = await db.purchase.findMany({
      where: { businessId, supplierId, status: { not: "cancelled" } },
      select: {
        id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
        paymentStatus: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Summary
    const summary = {
      totalPurchased: supplier.totalPurchased,
      totalPaid: supplier.totalPaid,
      balance: supplier.balance,
      purchaseCount: purchases.length,
      outstandingPurchases: purchases.filter((p) => p.paymentStatus !== "paid").length,
    };

    return NextResponse.json({
      success: true,
      supplier: { id: supplier.id, name: supplier.name, code: supplier.code },
      summary,
      purchases,
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

    // Determine payment allocation strategy
    // If purchaseId provided, apply to that purchase; otherwise, FIFO (oldest first)
    const allocationMode = body.purchaseId ? "specific" : "fifo";

    await db.$transaction(async (tx) => {
      if (allocationMode === "specific") {
        // Apply to specific purchase
        const purchase = await tx.purchase.findFirst({
          where: { id: body.purchaseId, businessId, supplierId, status: { not: "cancelled" } },
        });
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

        await tx.purchase.update({
          where: { id: purchase.id },
          data: { paidAmount: newPaid, paymentStatus },
        });
      } else {
        // FIFO allocation: pay oldest outstanding purchases first
        const outstanding = await tx.purchase.findMany({
          where: { businessId, supplierId, status: { not: "cancelled" }, paymentStatus: { in: ["partial", "unpaid"] } },
          orderBy: { createdAt: "asc" },
        });

        let remaining = amount;
        for (const purchase of outstanding) {
          if (remaining <= 0) break;
          const due = purchase.totalAmount - purchase.paidAmount;
          const apply = Math.min(due, remaining);

          const newPaid = purchase.paidAmount + apply;
          let paymentStatus = "partial";
          if (newPaid >= purchase.totalAmount) paymentStatus = "paid";

          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paidAmount: newPaid, paymentStatus },
          });
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
        method: body.method || "cash",
        reference: body.reference || null,
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
