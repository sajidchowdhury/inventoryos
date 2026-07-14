// GET/POST /api/businesses/[id]/mobile-shop/job-cards
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || "";
    const jobType = url.searchParams.get("jobType")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const priority = url.searchParams.get("priority")?.trim() || "";

    const where: Record<string, unknown> = { businessId, isActive: true };
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { jobCode: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { deviceName: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { reportedFault: { contains: search, mode: "insensitive" } },
        { assignedToName: { contains: search, mode: "insensitive" } },
      ];
    }

    const jobCards = await db.mSJobCard.findMany({
      where,
      include: {
        serialItem: {
          select: {
            id: true, serialNumber: true, imei: true, status: true, grade: true,
            product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          },
        },
      },
      orderBy: { receivedAt: "desc" },
    });

    return NextResponse.json(jobCards);
  } catch (error) {
    console.error("List job cards error:", error);
    return NextResponse.json({ error: "Failed to list job cards" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      jobType, customerName, customerPhone, serialItemId,
      productId, deviceName, serialNumber, imei,
      conditionNotes, photoUrls, reportedFault, estimatedCost,
      assignedToId, assignedToName, priority, internalNotes,
    } = body;

    if (!customerName?.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (!customerPhone?.trim()) {
      return NextResponse.json({ error: "Customer phone is required" }, { status: 400 });
    }
    if (!reportedFault?.trim()) {
      return NextResponse.json({ error: "Reported fault is required" }, { status: 400 });
    }

    // If serialItemId provided, validate it exists and auto-fill device info
    let deviceInfo = { deviceName: deviceName || null, serialNumber: serialNumber || null, imei: imei || null };
    if (serialItemId) {
      const serialItem = await db.mSSerialItem.findFirst({
        where: { id: serialItemId, businessId, isActive: true },
        include: { product: { select: { name: true, brand: true } } },
      });
      if (!serialItem) {
        return NextResponse.json({ error: "Serial item not found" }, { status: 404 });
      }
      deviceInfo = {
        deviceName: deviceName || `${serialItem.product?.brand || ""} ${serialItem.product?.name || ""}`.trim() || null,
        serialNumber: serialNumber || serialItem.serialNumber,
        imei: imei || serialItem.imei || null,
      };
    }

    // Auto-generate job code
    const year = new Date().getFullYear();
    const lastJob = await db.mSJobCard.findFirst({
      where: { businessId, jobCode: { startsWith: `JC-${year}-` } },
      orderBy: { jobCode: "desc" },
      select: { jobCode: true },
    });
    let seq = 1;
    if (lastJob) {
      const parts = lastJob.jobCode.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const jobCode = `JC-${year}-${String(seq).padStart(3, "0")}`;

    // If a serial item is linked and it's IN_STOCK, change to IN_REPAIR
    if (serialItemId) {
      const item = await db.mSSerialItem.findFirst({
        where: { id: serialItemId, businessId, status: "IN_STOCK", isActive: true },
      });
      if (item) {
        await db.mSSerialItem.update({
          where: { id: serialItemId },
          data: { status: "IN_REPAIR" },
        });
        await db.mSSerialItemHistory.create({
          data: {
            businessId,
            serialItemId,
            fromStatus: "IN_STOCK",
            toStatus: "IN_REPAIR",
            event: "REPAIR_START",
            notes: `Job card ${jobCode} created`,
          },
        });
      }
    }

    const jobCard = await db.mSJobCard.create({
      data: {
        businessId,
        jobCode,
        jobType: jobType || "REPAIR",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        serialItemId: serialItemId || null,
        productId: productId || null,
        ...deviceInfo,
        conditionNotes: conditionNotes?.trim() || null,
        photoUrls: typeof photoUrls === 'string' ? photoUrls : null,
        reportedFault: reportedFault.trim(),
        estimatedCost: estimatedCost ?? null,
        assignedToId: assignedToId || null,
        assignedToName: assignedToName?.trim() || null,
        priority: priority || "NORMAL",
        internalNotes: internalNotes?.trim() || null,
      },
      include: {
        serialItem: {
          select: {
            id: true, serialNumber: true, imei: true, status: true, grade: true,
            product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          },
        },
      },
    });

    return NextResponse.json(jobCard, { status: 201 });
  } catch (error) {
    console.error("Create job card error:", error);
    return NextResponse.json({ error: "Failed to create job card" }, { status: 500 });
  }
}