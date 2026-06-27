// GET/PUT /api/businesses/[id]/alert-preferences
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — fetch preferences (creates default if none exist)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    let prefs = await db.alertPreference.findUnique({
      where: { businessId },
    });

    if (!prefs) {
      // Create with defaults
      prefs = await db.alertPreference.create({
        data: { businessId },
      });
    }

    return NextResponse.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error("Get alert preferences error:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// PUT — update preferences
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Validate thresholds
    const critical = parseInt(body.expiryCriticalDays);
    const warning = parseInt(body.expiryWarningDays);
    const notice = parseInt(body.expiryNoticeDays);

    if (critical >= warning || warning >= notice) {
      return NextResponse.json(
        { error: "Thresholds must be: critical < warning < notice (e.g., 7 < 30 < 90)" },
        { status: 400 }
      );
    }

    if (critical < 1 || notice > 365) {
      return NextResponse.json(
        { error: "Critical threshold must be ≥1 day, notice threshold must be ≤365 days" },
        { status: 400 }
      );
    }

    // Validate digest frequency
    const validFreqs = ["daily", "weekly", "monthly", "none"];
    if (body.digestFrequency && !validFreqs.includes(body.digestFrequency)) {
      return NextResponse.json(
        { error: `digestFrequency must be one of: ${validFreqs.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate quiet hours
    if (body.quietHoursStart !== null && body.quietHoursStart !== undefined) {
      const start = parseInt(body.quietHoursStart);
      if (isNaN(start) || start < 0 || start > 23) {
        return NextResponse.json({ error: "quietHoursStart must be 0-23" }, { status: 400 });
      }
    }
    if (body.quietHoursEnd !== null && body.quietHoursEnd !== undefined) {
      const end = parseInt(body.quietHoursEnd);
      if (isNaN(end) || end < 0 || end > 23) {
        return NextResponse.json({ error: "quietHoursEnd must be 0-23" }, { status: 400 });
      }
    }

    // Upsert preferences
    const prefs = await db.alertPreference.upsert({
      where: { businessId },
      update: {
        expiryCriticalDays: critical,
        expiryWarningDays: warning,
        expiryNoticeDays: notice,
        lowStockEnabled: body.lowStockEnabled !== undefined ? !!body.lowStockEnabled : undefined,
        lowStockThreshold: parseInt(body.lowStockThreshold) || undefined,
        quarantineAlerts: body.quarantineAlerts !== undefined ? !!body.quarantineAlerts : undefined,
        emailEnabled: body.emailEnabled !== undefined ? !!body.emailEnabled : undefined,
        email: body.email !== undefined ? (body.email || null) : undefined,
        smsEnabled: body.smsEnabled !== undefined ? !!body.smsEnabled : undefined,
        phone: body.phone !== undefined ? (body.phone || null) : undefined,
        digestFrequency: body.digestFrequency || undefined,
        quietHoursStart: body.quietHoursStart !== undefined ? (body.quietHoursStart === null ? null : parseInt(body.quietHoursStart)) : undefined,
        quietHoursEnd: body.quietHoursEnd !== undefined ? (body.quietHoursEnd === null ? null : parseInt(body.quietHoursEnd)) : undefined,
      },
      create: {
        businessId,
        expiryCriticalDays: critical,
        expiryWarningDays: warning,
        expiryNoticeDays: notice,
        lowStockEnabled: body.lowStockEnabled ?? true,
        lowStockThreshold: parseInt(body.lowStockThreshold) || 10,
        quarantineAlerts: body.quarantineAlerts ?? true,
        emailEnabled: body.emailEnabled ?? false,
        email: body.email || null,
        smsEnabled: body.smsEnabled ?? false,
        phone: body.phone || null,
        digestFrequency: body.digestFrequency || "daily",
        quietHoursStart: body.quietHoursStart ?? null,
        quietHoursEnd: body.quietHoursEnd ?? null,
      },
    });

    return NextResponse.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error("Update alert preferences error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
