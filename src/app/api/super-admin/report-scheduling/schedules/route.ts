// ── GET/POST /api/super-admin/report-scheduling/schedules ──
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const businessTypeId = searchParams.get("businessTypeId"); // Phase 6: multi-project filter

    const where: any = {};
    if (businessTypeId) where.businessTypeId = businessTypeId;

    const schedules = await db.reportSchedule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { name, description, frequency, dayOfWeek, dayOfMonth, startDate, endDate,
      occasions, considerSeasons, considerEpidemics, targetClientMode, targetClientIds,
      deliveryChannels, reportPeriodDays, isActive, businessTypeId } = body;

    if (!name || !frequency) {
      return NextResponse.json({ error: "name and frequency are required" }, { status: 400 });
    }

    // Compute nextRunAt
    const now = new Date();
    let nextRunAt: Date | null = null;
    if (isActive !== false) {
      if (frequency === "weekly" && dayOfWeek !== undefined) {
        nextRunAt = new Date(now);
        nextRunAt.setDate(nextRunAt.getDate() + ((dayOfWeek - nextRunAt.getDay() + 7) % 7 || 7));
        nextRunAt.setHours(6, 0, 0, 0); // 6 AM
      } else if (frequency === "monthly" && dayOfMonth) {
        nextRunAt = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, 6, 0, 0);
      } else if (frequency === "date_range" && startDate) {
        nextRunAt = new Date(startDate);
        nextRunAt.setHours(6, 0, 0, 0);
      }
    }

    const schedule = await db.reportSchedule.create({
      data: {
        name, description: description || null, frequency,
        dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        occasions: JSON.stringify(occasions || []),
        considerSeasons: considerSeasons ?? true,
        considerEpidemics: considerEpidemics ?? true,
        targetClientMode: targetClientMode || "all",
        targetClientIds: targetClientIds ? JSON.stringify(targetClientIds) : null,
        deliveryChannels: JSON.stringify(deliveryChannels || ["email"]),
        reportPeriodDays: reportPeriodDays || 7,
        businessTypeId: businessTypeId || null, // Phase 6: null = all projects
        isActive: isActive ?? true,
        nextRunAt,
        createdBy: session.superAdmin.username,
      },
    });
    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (error) {
    console.error("[schedules] POST failed:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
