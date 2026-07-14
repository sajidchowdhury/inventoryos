// GET/POST /api/businesses/[id]/cctv/expenses
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    db.cCTVExpense.findMany({
      where: { businessId },
      orderBy: { expenseDate: "desc" },
      skip,
      take: limit,
    }),
    db.cCTVExpense.count({ where: { businessId } }),
  ]);

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    success: true,
    expenses,
    total,
    totalAmount,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount is required and must be > 0" }, { status: 400 });
  }

  const expense = await db.cCTVExpense.create({
    data: {
      businessId,
      category: body.category || "other",
      description: body.description || null,
      amount: parseFloat(body.amount),
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
    },
  });

  return NextResponse.json({ success: true, expense }, { status: 201 });
}
