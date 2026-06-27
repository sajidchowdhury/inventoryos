// GET/DELETE /api/businesses/[id]/sessions
// GET: List active sessions for all users in this business
// DELETE: Invalidate a specific session (force logout)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    const sessions = await db.session.findMany({
      where: {
        businessUser: { businessId },
        expiresAt: { gt: new Date() },
      },
      include: {
        businessUser: {
          select: { id: true, username: true, role: true, fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = sessions.map((s) => ({
      id: s.id,
      token: s.token.substring(0, 8) + "...", // mask token
      username: s.businessUser.username,
      fullName: s.businessUser.fullName,
      role: s.businessUser.role,
      deviceInfo: s.deviceInfo,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isExpired: s.expiresAt < new Date(),
    }));

    return NextResponse.json({
      success: true,
      sessions: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const sessionId = url.searchParams.get("sessionId");
    const allForUser = url.searchParams.get("userId");

    if (sessionId) {
      // Invalidate specific session
      const session = await db.session.findFirst({
        where: { id: sessionId, businessUser: { businessId } },
      });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      await db.session.delete({ where: { id: sessionId } });
      return NextResponse.json({ success: true, message: "Session invalidated (user logged out)" });
    }

    if (allForUser) {
      // Invalidate all sessions for a user
      const result = await db.session.deleteMany({
        where: { businessUserId: allForUser, businessUser: { businessId } },
      });
      return NextResponse.json({
        success: true,
        message: `${result.count} session(s) invalidated for user`,
      });
    }

    return NextResponse.json({ error: "Provide sessionId or userId parameter" }, { status: 400 });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Failed to invalidate session" }, { status: 500 });
  }
}
