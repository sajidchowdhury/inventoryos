// GET/POST /api/businesses/[id]/mobile-shop/warranty-claims
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List warranty claims
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { issueDescription: { contains: search, mode: "insensitive" } },
      ];
    }

    const claims = await db.mSWarrantyClaim.findMany({
      where,
      include: {
        serialItem: {
          select: {
            serialNumber: true,
            imei: true,
            product: { select: { name: true, brand: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(claims);
  } catch (error) {
    console.error("List warranty claims error:", error);
    return NextResponse.json({ error: "Failed to list warranty claims" }, { status: 500 });
  }
}

// POST: Create a warranty claim
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { serialItemId, issueDescription, customerName, customerPhone } = body as {
      serialItemId?: string;
      issueDescription?: string;
      customerName?: string;
      customerPhone?: string;
    };

    // Validate required fields
    if (!serialItemId || !issueDescription?.trim()) {
      return NextResponse.json(
        { error: "serialItemId and issueDescription are required" },
        { status: 400 }
      );
    }

    // Validate serial item exists, belongs to business, is active
    const serialItem = await db.mSSerialItem.findFirst({
      where: { id: serialItemId, businessId, isActive: true },
    });

    if (!serialItem) {
      return NextResponse.json({ error: "Serial item not found" }, { status: 404 });
    }

    // Validate warranty is still active
    if (!serialItem.warrantyEnd) {
      return NextResponse.json(
        { error: "This item does not have a warranty period" },
        { status: 400 }
      );
    }

    if (serialItem.warrantyEnd <= new Date()) {
      return NextResponse.json(
        { error: "Warranty has expired for this item" },
        { status: 400 }
      );
    }

    // Create the claim
    const claim = await db.mSWarrantyClaim.create({
      data: {
        businessId,
        serialItemId,
        customerName: customerName?.trim() || serialItem.customerName || "",
        customerPhone: customerPhone?.trim() || serialItem.customerPhone || null,
        issueDescription: issueDescription.trim(),
        status: "PENDING",
      },
      include: {
        serialItem: {
          select: {
            serialNumber: true,
            imei: true,
            product: { select: { name: true, brand: true } },
          },
        },
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    console.error("Create warranty claim error:", error);
    return NextResponse.json({ error: "Failed to create warranty claim" }, { status: 500 });
  }
}