// GET /api/businesses/[id]/suppliers/[supplierId]/balance
// Returns detailed balance breakdown with aging buckets (Purchase + MSPurchase)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface AgedPurchase {
  id: string;
  purchaseNo: string;
  invoiceNo?: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  createdAt: Date;
  ageDays: number;
  bucket: string;
  source: "purchase" | "mobile-shop";
}

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

    // Fetch outstanding general purchases
    const generalPurchases = await db.purchase.findMany({
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

    // Fetch outstanding CCTV purchases
    const cctvPurchases = await db.mSPurchase.findMany({
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

    // Aging buckets
    const aging = {
      current: { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "61-90": { count: 0, amount: 0 },
      "90+": { count: 0, amount: 0 },
    };

    function processPurchase(p: { id: string; purchaseNo: string; invoiceNo?: string | null; totalAmount: number; paidAmount: number; createdAt: Date }, source: "purchase" | "mobile-shop"): AgedPurchase {
      const due = p.totalAmount - p.paidAmount;
      const ageDays = Math.floor((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      totalDue += due;
      totalInvoiced += p.totalAmount;
      totalPaid += p.paidAmount;

      let bucket: string;
      if (ageDays <= 30) {
        aging.current.amount += due;
        aging.current.count++;
        bucket = "current";
      } else if (ageDays <= 60) {
        aging["31-60"].amount += due;
        aging["31-60"].count++;
        bucket = "31-60";
      } else if (ageDays <= 90) {
        aging["61-90"].amount += due;
        aging["61-90"].count++;
        bucket = "61-90";
      } else {
        aging["90+"].amount += due;
        aging["90+"].count++;
        bucket = "90+";
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
        bucket,
        source,
      };
    }

    const allOutstanding = [
      ...generalPurchases.map((p) => processPurchase(p, "purchase")),
      ...cctvPurchases.map((p) => processPurchase(p, "mobile-shop")),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // All-time purchase history (last 15, both sources)
    const [generalHistory, cctvHistory] = await Promise.all([
      db.purchase.findMany({
        where: { businessId, supplierId, status: { not: "cancelled" } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
          paymentStatus: true, status: true, createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      db.mSPurchase.findMany({
        where: { businessId, supplierId, status: { not: "cancelled" } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true, purchaseNo: true, totalAmount: true, paidAmount: true,
          paymentStatus: true, status: true, createdAt: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    const purchaseHistory = [
      ...generalHistory.map((p) => ({ ...p, source: "purchase" as const })),
      ...cctvHistory.map((p) => ({ ...p, source: "mobile-shop" as const })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

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
        outstandingCount: allOutstanding.length,
        oldestDueDays: allOutstanding.length > 0 ? allOutstanding[0].ageDays : 0,
        generalOutstanding: generalPurchases.length,
        cctvOutstanding: cctvPurchases.length,
      },
      aging,
      outstandingPurchases: allOutstanding,
      purchaseHistory,
    });
  } catch (error) {
    console.error("Supplier balance error:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}