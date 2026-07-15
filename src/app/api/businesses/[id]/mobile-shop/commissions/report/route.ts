// GET /api/businesses/[id]/mobile-shop/commissions/report
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM

    const records = await db.mSCommissionRecord.findMany({
      where: { businessId, month },
      include: {
        technician: { select: { id: true, displayName: true } },
        jobCard: { select: { id: true, jobCode: true, customerName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by technician
    const byTechnician: Record<string, {
      technician: { id: string; displayName: string };
      records: typeof records;
      total: number;
    }> = {};

    let grandTotal = 0;
    for (const r of records) {
      if (!byTechnician[r.technicianId]) {
        byTechnician[r.technicianId] = {
          technician: r.technician!,
          records: [],
          total: 0,
        };
      }
      byTechnician[r.technicianId].records.push(r);
      byTechnician[r.technicianId].total += r.commissionAmount;
      grandTotal += r.commissionAmount;
    }

    // Available months (for month picker)
    const months = await db.mSCommissionRecord.findMany({
      where: { businessId },
      distinct: ["month"],
      select: { month: true },
      orderBy: { month: "desc" },
    });

    return NextResponse.json({
      month,
      records,
      byTechnician: Object.values(byTechnician).sort((a, b) => b.total - a.total),
      grandTotal: Math.round(grandTotal),
      availableMonths: months.map((m) => m.month),
    });
  } catch (error) {
    console.error("Commission report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}