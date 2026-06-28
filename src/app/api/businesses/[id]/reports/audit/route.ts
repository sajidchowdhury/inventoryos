// GET /api/businesses/[id]/reports/audit
// Comprehensive audit trail: all transactions, sales, purchases, payments, returns, stock movements
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    const modParam = url.searchParams.get("module") || ""; // sales, purchases, inventory, payments, returns
    const entityType = url.searchParams.get("entityType") || ""; // product, batch, sale, purchase, customer, supplier
    const entityId = url.searchParams.get("entityId") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Fetch from multiple sources in parallel based on module filter
    const events: Array<{
      id: string;
      timestamp: string;
      module: string;
      eventType: string;
      entityType: string;
      entityId: string;
      description: string;
      amount?: number;
      quantity?: number;
      actor?: string;
      reference?: string;
    }> = [];

    const fetchSales = !modParam || modParam === "sales";
    const fetchPurchases = !modParam || modParam === "purchases";
    const fetchInventory = !modParam || modParam === "inventory";
    const fetchPayments = !modParam || modParam === "payments";
    const fetchReturns = !modParam || modParam === "returns";

    if (fetchSales) {
      const where: Record<string, unknown> = { businessId };
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
      if (entityType === "sale" && entityId) where.id = entityId;
      const sales = await db.sale.findMany({
        where,
        select: {
          id: true, invoiceNo: true, status: true, totalAmount: true,
          createdAt: true, customerId: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      });
      sales.forEach((s) => {
        events.push({
          id: `sale_${s.id}`,
          timestamp: s.createdAt.toISOString(),
          module: "Sales",
          eventType: s.status === "cancelled" ? "Sale Cancelled" : "Sale Created",
          entityType: "sale",
          entityId: s.id,
          description: `Invoice ${s.invoiceNo} — ${s.customer?.name || "Walk-in"} — ৳${s.totalAmount.toFixed(2)}`,
          amount: s.totalAmount,
          reference: s.invoiceNo,
        });
      });
    }

    if (fetchPurchases) {
      const where: Record<string, unknown> = { businessId };
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
      if (entityType === "purchase" && entityId) where.id = entityId;
      const purchases = await db.purchase.findMany({
        where,
        select: {
          id: true, purchaseNo: true, status: true, totalAmount: true,
          createdAt: true, supplierId: true,
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      });
      purchases.forEach((p) => {
        events.push({
          id: `purchase_${p.id}`,
          timestamp: p.createdAt.toISOString(),
          module: "Purchases",
          eventType: p.status === "cancelled" ? "Purchase Cancelled" : "Purchase Recorded",
          entityType: "purchase",
          entityId: p.id,
          description: `PO ${p.purchaseNo} — ${p.supplier?.name || "Unknown"} — ৳${p.totalAmount.toFixed(2)}`,
          amount: p.totalAmount,
          reference: p.purchaseNo,
        });
      });
    }

    if (fetchInventory) {
      const where: Record<string, unknown> = { businessId };
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
      if (entityType === "product" && entityId) where.productId = entityId;
      if (entityType === "batch" && entityId) where.batchId = entityId;
      const transactions = await db.transaction.findMany({
        where,
        select: {
          id: true, type: true, quantity: true, unitPrice: true, note: true,
          createdAt: true, productId: true, batchId: true,
          product: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      });
      transactions.forEach((t) => {
        events.push({
          id: `txn_${t.id}`,
          timestamp: t.createdAt.toISOString(),
          module: "Inventory",
          eventType: t.type,
          entityType: t.batchId ? "batch" : "product",
          entityId: t.batchId || t.productId,
          description: t.note || `${t.type}: ${t.quantity} units of ${t.product?.name || "unknown"}`,
          quantity: t.quantity,
          amount: t.unitPrice ? t.unitPrice * t.quantity : undefined,
        });
      });
    }

    if (fetchPayments) {
      const where: Record<string, unknown> = { businessId };
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
      const payments = await db.payment.findMany({
        where,
        select: {
          id: true, amount: true, paymentMethod: true, reference: true,
          createdAt: true, saleId: true,
          sale: { select: { invoiceNo: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      });
      payments.forEach((p) => {
        events.push({
          id: `payment_${p.id}`,
          timestamp: p.createdAt.toISOString(),
          module: "Payments",
          eventType: "Payment Received",
          entityType: "sale",
          entityId: p.saleId,
          description: `Payment for ${p.sale?.invoiceNo || "unknown"} — ৳${p.amount.toFixed(2)} via ${p.paymentMethod}`,
          amount: p.amount,
          reference: p.reference || undefined,
        });
      });
    }

    if (fetchReturns) {
      const where: Record<string, unknown> = { businessId };
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
      const returns = await db.return.findMany({
        where,
        select: {
          id: true, returnNo: true, refundAmount: true, reason: true,
          createdAt: true, saleId: true, customerId: true,
          sale: { select: { invoiceNo: true } },
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      });
      returns.forEach((r) => {
        events.push({
          id: `return_${r.id}`,
          timestamp: r.createdAt.toISOString(),
          module: "Returns",
          eventType: "Return Processed",
          entityType: "sale",
          entityId: r.saleId,
          description: `Return ${r.returnNo} for ${r.sale?.invoiceNo || "unknown"} — ৳${r.refundAmount.toFixed(2)} (${r.reason})`,
          amount: -r.refundAmount,
          reference: r.returnNo,
        });
      });
    }

    // Sort all events by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate the merged results
    const paginatedEvents = events.slice(0, limit);

    // Summary by module
    const summaryByModule = events.reduce((acc, e) => {
      acc[e.module] = (acc[e.module] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Summary by event type
    const summaryByType = events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      events: paginatedEvents,
      totalEvents: events.length,
      pagination: { page, limit, total: events.length, totalPages: Math.ceil(events.length / limit) },
      summary: {
        byModule: summaryByModule,
        byType: summaryByType,
        totalAmount: events.reduce((sum, e) => sum + (e.amount || 0), 0),
      },
    });
  } catch (error) {
    console.error("Audit trail error:", error);
    return NextResponse.json({ error: "Failed to fetch audit trail" }, { status: 500 });
  }
}
