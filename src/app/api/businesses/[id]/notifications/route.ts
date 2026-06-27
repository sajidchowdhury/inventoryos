// GET/PUT /api/businesses/[id]/notifications
// GET: List notification logs with filters
// PUT: Mark notifications as read (body: { notificationIds?: string[], all?: boolean })
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const type = url.searchParams.get("type") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: Record<string, unknown> = { businessId };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const [notifications, unreadCount] = await Promise.all([
      db.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.notificationLog.count({
        where: { businessId, isRead: false },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      totalCount: notifications.length,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (body.all === true) {
      // Mark all as read
      const result = await db.notificationLog.updateMany({
        where: { businessId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        markedRead: result.count,
      });
    }

    if (Array.isArray(body.notificationIds) && body.notificationIds.length > 0) {
      const result = await db.notificationLog.updateMany({
        where: {
          businessId,
          id: { in: body.notificationIds },
        },
        data: { isRead: true, readAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        markedRead: result.count,
      });
    }

    return NextResponse.json({ error: "Provide notificationIds array or all=true" }, { status: 400 });
  } catch (error) {
    console.error("Mark notifications error:", error);
    return NextResponse.json({ error: "Failed to mark notifications" }, { status: 500 });
  }
}

// DELETE — clear resolved/old notifications
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const olderThanDays = parseInt(url.searchParams.get("olderThanDays") || "30");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await db.notificationLog.deleteMany({
      where: {
        businessId,
        isRead: true,
        createdAt: { lt: cutoff },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} read notifications older than ${olderThanDays} days`,
    });
  } catch (error) {
    console.error("Delete notifications error:", error);
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
  }
}
