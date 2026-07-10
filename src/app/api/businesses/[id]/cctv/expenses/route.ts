// POST/GET/DELETE /api/businesses/[id]/cctv/expenses
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_CATEGORIES = ["RENT", "SALARY", "TRANSPORT", "UTILITY", "MISC"];
const VALID_METHODS = ["CASH", "CARD", "BKASH", "NAGAD", "ROCKET", "BANK_TRANSFER"];

// ── GET: List expenses with optional filters ──
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;

    const category = url.searchParams.get("category") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const month = url.searchParams.get("month") || ""; // "YYYY-MM"
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    if (from || to) {
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.date = dateFilter;
    }

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const monthStart = new Date(year, mon - 1, 1);
      const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
      where.date = { gte: monthStart, lte: monthEnd };
    }

    const [expenses, total] = await Promise.all([
      db.cCTVExpense.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      db.cCTVExpense.count({ where }),
    ]);

    // Aggregate stats
    const statsWhere: Record<string, unknown> = { businessId, isActive: true };

    // Monthly totals (last 6 months)
    const now = new Date();
    const monthlyTotals: Array<{ month: string; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const mLabel = mStart.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

      const agg = await db.cCTVExpense.aggregate({
        where: { ...statsWhere, date: { gte: mStart, lte: mEnd } },
        _sum: { amount: true },
        _count: true,
      });

      monthlyTotals.push({
        month: mLabel,
        total: agg._sum.amount || 0,
      });
    }

    // Category breakdown (current month)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const categoryBreakdown = await db.cCTVExpense.groupBy({
      by: ["category"],
      where: { ...statsWhere, date: { gte: currentMonthStart } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // Overall totals
    const overall = await db.cCTVExpense.aggregate({
      where: statsWhere,
      _sum: { amount: true },
      _count: true,
    });

    // This month total
    const thisMonth = await db.cCTVExpense.aggregate({
      where: { ...statsWhere, date: { gte: currentMonthStart } },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      expenses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        overallTotal: overall._sum.amount || 0,
        overallCount: overall._count,
        thisMonthTotal: thisMonth._sum.amount || 0,
        thisMonthCount: thisMonth._count,
        monthlyTotals,
        categoryBreakdown: categoryBreakdown.map((c) => ({
          category: c.category,
          total: c._sum.amount || 0,
          count: c._count,
        })),
      },
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

// ── POST: Create expense ──
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (body.paymentMethod && !VALID_METHODS.includes(body.paymentMethod)) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${VALID_METHODS.join(", ")}` },
        { status: 400 }
      );
    }

    const expense = await db.cCTVExpense.create({
      data: {
        businessId,
        date: new Date(body.date),
        category: body.category,
        amount,
        description: body.description?.trim() || null,
        paymentMethod: body.paymentMethod || null,
        reference: body.reference?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

// ── DELETE: Soft-delete expense ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const expenseId = url.searchParams.get("id");

    if (!expenseId) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    const expense = await db.cCTVExpense.findFirst({
      where: { id: expenseId, businessId, isActive: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await db.cCTVExpense.update({
      where: { id: expenseId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}