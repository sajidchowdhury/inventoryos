// GET /api/businesses/[id]/cctv/amc-contracts  → list
// POST /api/businesses/[id]/cctv/amc-contracts → create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const EXPIRING_DAYS = 90;

function computeStatus(endDate: Date, now: Date): string {
  const endMs = endDate.getTime();
  const nowMs = now.getTime();
  const expiringThreshold = nowMs + EXPIRING_DAYS * MS_PER_DAY;
  if (endMs <= nowMs) return "EXPIRED";
  if (endMs <= expiringThreshold) return "EXPIRING_SOON";
  return "ACTIVE";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";

    const where: Record<string, unknown> = {
      businessId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { contractCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const contracts = await db.cCTVAmcContract.findMany({
      where,
      include: {
        _count: { select: { visits: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    const result = contracts
      .map((c) => {
        const end = new Date(c.endDate);
        const computedStatus = computeStatus(end, now);
        const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);

        // Update status in DB if it drifted
        if (computedStatus !== c.status && c.status !== "CANCELLED") {
          db.cCTVAmcContract.update({
            where: { id: c.id },
            data: { status: computedStatus },
          }).catch(() => {});
        }

        return {
          ...c,
          status: c.status === "CANCELLED" ? "CANCELLED" : computedStatus,
          daysRemaining,
          _count: c._count,
        };
      })
      .filter((c) => {
        if (!status) return true;
        return c.status === status;
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error("List AMC contracts error:", error);
    return NextResponse.json({ error: "Failed to list AMC contracts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      coverageType,
      startDate,
      endDate,
      totalAmount,
      paymentFrequency,
      paymentAmount,
      visitsIncluded,
      slaTerms,
      responseHours,
      notes,
    } = body;

    if (!clientName?.trim()) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start and end dates are required" }, { status: 400 });
    }
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "Contract value is required" }, { status: 400 });
    }

    // Compute payment amount if not provided
    let computedPaymentAmount = paymentAmount;
    if (!computedPaymentAmount && totalAmount) {
      const freq = paymentFrequency || "MONTHLY";
      if (freq === "MONTHLY") computedPaymentAmount = totalAmount / 12;
      else if (freq === "QUARTERLY") computedPaymentAmount = totalAmount / 4;
      else computedPaymentAmount = totalAmount;
    }

    // Generate contract code
    const count = await db.cCTVAmcContract.count({ where: { businessId } });
    const contractCode = `AMC-${String(count + 1).padStart(3, "0")}`;

    // Compute initial status
    const now = new Date();
    const end = new Date(endDate);
    const endMs = end.getTime();
    const nowMs = now.getTime();
    const expiringThreshold = nowMs + EXPIRING_DAYS * MS_PER_DAY;
    let status = "ACTIVE";
    if (endMs <= nowMs) status = "EXPIRED";
    else if (endMs <= expiringThreshold) status = "EXPIRING_SOON";

    const contract = await db.cCTVAmcContract.create({
      data: {
        businessId,
        contractCode,
        clientName: clientName.trim(),
        clientPhone: clientPhone?.trim() || null,
        clientEmail: clientEmail?.trim() || null,
        clientAddress: clientAddress?.trim() || null,
        coverageType: coverageType || "Standard",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalAmount: Number(totalAmount),
        paymentFrequency: paymentFrequency || "MONTHLY",
        paymentAmount: Number(computedPaymentAmount),
        visitsIncluded: Number(visitsIncluded) || 1,
        slaTerms: slaTerms?.trim() || null,
        responseHours: Number(responseHours) || 48,
        status,
        notes: notes?.trim() || null,
      },
      include: { _count: { select: { visits: true } } },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Create AMC contract error:", error);
    return NextResponse.json({ error: "Failed to create AMC contract" }, { status: 500 });
  }
}