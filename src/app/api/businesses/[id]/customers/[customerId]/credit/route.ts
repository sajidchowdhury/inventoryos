// GET /api/businesses/[id]/customers/[customerId]/credit
// Returns customer's outstanding balance across all sales
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;

    // Verify customer
    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Find all sales with outstanding balance
    const outstandingSales = await db.sale.findMany({
      where: {
        businessId,
        customerId,
        status: "completed",
        paymentStatus: { in: ["partial", "unpaid"] },
      },
      include: {
        items: { select: { productName: true, quantity: true, unitPrice: true, totalPrice: true } },
        payments: {
          select: { id: true, amount: true, paymentMethod: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" }, // oldest first (FIFO for credit)
    });

    // Calculate totals
    let totalDue = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;
    const salesWithDue = outstandingSales.map((sale) => {
      const due = sale.totalAmount - sale.paidAmount;
      totalDue += due;
      totalInvoiced += sale.totalAmount;
      totalPaid += sale.paidAmount;
      return {
        id: sale.id,
        invoiceNo: sale.invoiceNo,
        createdAt: sale.createdAt,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        dueAmount: due,
        itemCount: sale.items.length,
        age: Math.floor((Date.now() - sale.createdAt.getTime()) / (1000 * 60 * 60 * 24)), // days
        lastPayment: sale.payments[0] || null,
      };
    });

    // Payment history (last 10 payments)
    const paymentHistory = await db.payment.findMany({
      where: { businessId, customerId },
      include: {
        sale: { select: { invoiceNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Returns history (last 5)
    const returnsHistory = await db.return.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, returnNo: true, refundAmount: true, refundMethod: true,
        reason: true, createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        totalSpent: customer.totalSpent,
        visitCount: customer.visitCount,
      },
      credit: {
        totalDue,
        totalInvoiced,
        totalPaid,
        outstandingSaleCount: salesWithDue.length,
        oldestDueDays: salesWithDue.length > 0 ? salesWithDue[0].age : 0,
      },
      outstandingSales: salesWithDue,
      paymentHistory: paymentHistory.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.paymentMethod,
        invoiceNo: p.sale.invoiceNo,
        reference: p.reference,
        createdAt: p.createdAt,
      })),
      returnsHistory,
    });
  } catch (error) {
    console.error("Customer credit error:", error);
    return NextResponse.json({ error: "Failed to fetch customer credit" }, { status: 500 });
  }
}
