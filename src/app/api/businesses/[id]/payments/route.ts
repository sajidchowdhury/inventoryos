// GET/POST /api/businesses/[id]/payments
// GET: List payments with filters
// POST: Record a payment against a sale (updates sale.paidAmount + paymentStatus)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const saleId = url.searchParams.get("saleId") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const method = url.searchParams.get("method") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (saleId) where.saleId = saleId;
    if (customerId) where.customerId = customerId;
    if (method) where.paymentMethod = method;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          sale: {
            select: { id: true, invoiceNo: true, totalAmount: true, paidAmount: true },
          },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.payment.count({ where }),
    ]);

    // Summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayPayments = await db.payment.aggregate({
      where: { businessId, createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
      _count: true,
    });

    // By method (last 30 days)
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    const byMethod = await db.payment.groupBy({
      by: ["paymentMethod"],
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        today: {
          count: todayPayments._count,
          total: todayPayments._sum.amount || 0,
        },
        byMethod: byMethod.map((m) => ({
          method: m.paymentMethod,
          total: m._sum.amount || 0,
          count: m._count,
        })),
      },
    });
  } catch (error) {
    console.error("Get payments error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Validate
    if (!body.saleId) {
      return NextResponse.json({ error: "saleId is required" }, { status: 400 });
    }
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const validMethods = ["cash", "card", "mobile_banking", "credit", "cheque"];
    if (body.paymentMethod && !validMethods.includes(body.paymentMethod)) {
      return NextResponse.json(
        { error: `paymentMethod must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch sale
    const sale = await db.sale.findFirst({
      where: { id: body.saleId, businessId },
    });
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    if (sale.status === "cancelled") {
      return NextResponse.json({ error: "Cannot pay for a cancelled sale" }, { status: 400 });
    }

    const newPaidAmount = sale.paidAmount + amount;

    // Check for overpayment
    if (newPaidAmount > sale.totalAmount) {
      return NextResponse.json(
        {
          error: `Overpayment detected. Sale total is ৳${sale.totalAmount.toFixed(2)}, already paid ৳${sale.paidAmount.toFixed(2)}. Maximum additional payment: ৳${(sale.totalAmount - sale.paidAmount).toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Determine new payment status
    let paymentStatus = "paid";
    if (newPaidAmount < sale.totalAmount) paymentStatus = "partial";
    if (newPaidAmount <= 0) paymentStatus = "unpaid";

    // Atomic: create payment + update sale
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          businessId,
          saleId: body.saleId,
          customerId: sale.customerId,
          amount,
          paymentMethod: body.paymentMethod || "cash",
          reference: body.reference?.trim() || null,
          notes: body.notes?.trim() || null,
          receivedBy: body.receivedBy || null,
        },
      });

      // Update sale
      await tx.sale.update({
        where: { id: body.saleId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus,
          paymentMethod: body.paymentMethod || sale.paymentMethod,
        },
      });

      return newPayment;
    });

    return NextResponse.json({
      success: true,
      payment,
      sale: {
        paidAmount: newPaidAmount,
        paymentStatus,
        dueAmount: sale.totalAmount - newPaidAmount,
      },
      message: `Payment of ৳${amount.toFixed(2)} recorded. Due: ৳${(sale.totalAmount - newPaidAmount).toFixed(2)}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
