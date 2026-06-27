// GET /api/businesses/[id]/suppliers/[supplierId]/balance
// Returns detailed balance breakdown with aging buckets
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

    // Fetch all outstanding purchases (partial + unpaid)
    const outstandingPurchases = await db.purchase.findMany({
      where: {
        businessId, supplierId,
        status: { not: "cancelled" },
        paymentStatus: { in: ["partial", "unpaid"] },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
        createdAt: true, invoiceNo: true,
      },
    });

    const now = new Date();
    let totalDue = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;

    // Aging buckets: 0-30d, 31-60d, 61-90d, 90+d
    const aging = {
      current: { count: 0, amount: 0 },     // 0-30 days
      "31-60": { count: 0, amount: 0 },     // 31-60 days
      "61-90": { count: 0, amount: 0 },     // 61-90 days
      "90+": { count: 0, amount: 0 },       // 90+ days
    };

    const purchasesWithAge = outstandingPurchases.map((p) => {
      const due = p.totalAmount - p.paidAmount;
      const ageDays = Math.floor((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      totalDue += due;
      totalInvoiced += p.totalAmount;
      totalPaid += p.paidAmount;

      // Assign to aging bucket
      if (ageDays <= 30) {
        aging.current.amount += due;
        aging.current.count++;
      } else if (ageDays <= 60) {
        aging["31-60"].amount += due;
        aging["31-60"].count++;
      } else if (ageDays <= 90) {
        aging["61-90"].amount += due;
        aging["61-90"].count++;
      } else {
        aging["90+"].amount += due;
        aging["90+"].count++;
      }

      return {
        id: p.id,
        purchaseNo: p.purchaseNo,
        invoiceNo: p.invoiceNo,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
        dueAmount: due,
        createdAt: p.createdAt,
        ageDays,
        bucket: ageDays <= 30 ? "current" : ageDays <= 60 ? "31-60" : ageDays <= 90 ? "61-90" : "90+",
      };
    });

    // All-time purchase history (last 10)
    const purchaseHistory = await db.purchase.findMany({
      where: { businessId, supplierId, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
        paymentStatus: true, status: true, createdAt: true,
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        phone: supplier.phone,
        contactPerson: supplier.contactPerson,
      },
      summary: {
        totalDue,
        totalInvoiced,
        totalPaid,
        outstandingCount: purchasesWithAge.length,
        oldestDueDays: purchasesWithAge.length > 0 ? purchasesWithAge[0].ageDays : 0,
      },
      aging,
      outstandingPurchases: purchasesWithAge,
      purchaseHistory,
    });
  } catch (error) {
    console.error("Supplier balance error:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
