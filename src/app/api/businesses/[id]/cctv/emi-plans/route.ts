// GET/POST /api/businesses/[id]/cctv/emi-plans
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List EMI plans with optional filters
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { productName: { contains: search } },
      ];
    }

    const plans = await db.cCTVEmiPlan.findMany({
      where,
      include: {
        _count: {
          select: { installments: true },
        },
        installments: {
          where: { status: "OVERDUE" },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach overdueCount derived from the filtered installments
    const result = plans.map((plan) => ({
      ...plan,
      overdueCount: plan.installments.length,
      installments: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("List EMI plans error:", error);
    return NextResponse.json({ error: "Failed to list EMI plans" }, { status: 500 });
  }
}

// POST: Create EMI plan with auto-generated installments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      customerName,
      customerPhone,
      productName,
      productBrand,
      totalAmount,
      downPayment,
      interestRate,
      interestType,
      months,
      startDate,
      graceDays,
      saleId,
      notes,
    } = body as {
      customerName?: string;
      customerPhone?: string;
      productName?: string;
      productBrand?: string;
      totalAmount?: number;
      downPayment?: number;
      interestRate?: number;
      interestType?: string;
      months?: number;
      startDate?: string;
      graceDays?: number;
      saleId?: string;
      notes?: string;
    };

    // Validate required fields
    if (!customerName?.trim()) {
      return NextResponse.json({ error: "customerName is required" }, { status: 400 });
    }
    if (!customerPhone?.trim()) {
      return NextResponse.json({ error: "customerPhone is required" }, { status: 400 });
    }
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "totalAmount must be greater than 0" }, { status: 400 });
    }
    if (!months || months <= 0) {
      return NextResponse.json({ error: "months must be greater than 0" }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    }

    const dp = downPayment || 0;
    const rate = interestRate || 0;
    const iType = interestType || "REDUCING";
    const grace = graceDays ?? 3;

    const financedAmount = totalAmount - dp;
    const start = new Date(startDate);

    // Calculate EMI based on interest type
    let totalInterest = 0;
    let grandTotal = 0;
    let monthlyPayment = 0;

    if (iType === "FLAT") {
      totalInterest = financedAmount * (rate / 100) * (months / 12);
      grandTotal = financedAmount + totalInterest;
      monthlyPayment = grandTotal / months;
    } else {
      // REDUCING balance EMI formula
      if (rate === 0) {
        monthlyPayment = financedAmount / months;
        totalInterest = 0;
      } else {
        const r = rate / 12 / 100;
        const factor = Math.pow(1 + r, months);
        monthlyPayment = (financedAmount * r * factor) / (factor - 1);
        totalInterest = monthlyPayment * months - financedAmount;
      }
      grandTotal = financedAmount + totalInterest;
    }

    const remainingAmount = grandTotal;

    // Execute in a transaction
    const plan = await db.$transaction(async (tx) => {
      // 1. Create the EMI plan
      const createdPlan = await tx.cCTVEmiPlan.create({
        data: {
          businessId,
          saleId: saleId || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          productName: productName?.trim() || "",
          productBrand: productBrand?.trim() || null,
          totalAmount,
          downPayment: dp,
          financedAmount,
          interestRate: rate,
          interestType: iType,
          totalInterest,
          grandTotal,
          months,
          monthlyPayment,
          startDate: start,
          graceDays: grace,
          paidInstallments: 0,
          paidAmount: 0,
          remainingAmount,
          status: "ACTIVE",
          notes: notes?.trim() || null,
          isActive: true,
        },
      });

      // 2. Generate installment records
      for (let i = 1; i <= months; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));

        await tx.cCTVEmiInstallment.create({
          data: {
            businessId,
            emiPlanId: createdPlan.id,
            installmentNo: i,
            dueDate,
            dueAmount: monthlyPayment,
            status: "PENDING",
            isActive: true,
          },
        });
      }

      // 3. If saleId provided, update sale status to PARTIALLY_PAID
      if (saleId) {
        const sale = await tx.cCTVSale.findFirst({
          where: { id: saleId, businessId, isActive: true },
          select: { id: true },
        });
        if (sale) {
          await tx.cCTVSale.update({
            where: { id: saleId },
            data: { status: "PARTIALLY_PAID" },
          });
        }
      }

      return createdPlan;
    });

    // Fetch the created plan with all installments
    const fullPlan = await db.cCTVEmiPlan.findUnique({
      where: { id: plan.id },
      include: {
        installments: {
          orderBy: { installmentNo: "asc" },
        },
      },
    });

    return NextResponse.json(fullPlan, { status: 201 });
  } catch (error) {
    console.error("Create EMI plan error:", error);
    return NextResponse.json({ error: "Failed to create EMI plan" }, { status: 500 });
  }
}