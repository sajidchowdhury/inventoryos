// GET /api/businesses/[id]/login-activity
// Returns login activity: recent sessions (created = login), user last login times
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    // Recent sessions = login events
    const recentSessions = await db.session.findMany({
      where: { businessUser: { businessId } },
      include: {
        businessUser: {
          select: { id: true, username: true, role: true, fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const loginEvents = recentSessions.map((s) => ({
      id: s.id,
      username: s.businessUser.username,
      fullName: s.businessUser.fullName,
      role: s.businessUser.role,
      deviceInfo: s.deviceInfo,
      loginAt: s.createdAt,
      expiresAt: s.expiresAt,
      isActive: s.expiresAt > new Date(),
    }));

    // User last login times
    const users = await db.businessUser.findMany({
      where: { businessId },
      select: {
        id: true, username: true, role: true, fullName: true,
        lastLoginAt: true, isActive: true, createdAt: true,
      },
      orderBy: { lastLoginAt: "desc" },
    });

    // Summary
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);

    const loginsToday = loginEvents.filter((e) => new Date(e.loginAt) >= todayStart).length;
    const loginsThisWeek = loginEvents.filter((e) => new Date(e.loginAt) >= weekStart).length;
    const activeUsers = users.filter((u) => u.isActive).length;
    const neverLoggedIn = users.filter((u) => !u.lastLoginAt).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: users.length,
        activeUsers,
        neverLoggedIn,
        loginsToday,
        loginsThisWeek,
        activeSessions: loginEvents.filter((e) => e.isActive).length,
      },
      recentLogins: loginEvents,
      userLoginStatus: users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt,
        daysSinceLogin: u.lastLoginAt
          ? Math.floor((now.getTime() - u.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
    });
  } catch (error) {
    console.error("Login activity error:", error);
    return NextResponse.json({ error: "Failed to fetch login activity" }, { status: 500 });
  }
}
