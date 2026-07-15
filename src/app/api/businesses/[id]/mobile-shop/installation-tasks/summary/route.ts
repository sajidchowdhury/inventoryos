// GET /api/businesses/[id]/mobile-shop/installation-tasks/summary → summary stats
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const now = new Date();

    // Auto-update overdue before computing
    await db.mSInstallationTask.updateMany({
      where: {
        businessId,
        isActive: true,
        scheduledDate: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "OVERDUE" },
    });

    const baseWhere = { businessId, isActive: true };

    // Count pending
    const totalPending = await db.mSInstallationTask.count({
      where: { ...baseWhere, status: "PENDING" },
    });

    // Count in progress
    const totalInProgress = await db.mSInstallationTask.count({
      where: { ...baseWhere, status: "IN_PROGRESS" },
    });

    // Count overdue
    const totalOverdue = await db.mSInstallationTask.count({
      where: { ...baseWhere, status: "OVERDUE" },
    });

    // Count completed today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const totalCompletedToday = await db.mSInstallationTask.count({
      where: {
        ...baseWhere,
        status: "COMPLETED",
        completedDate: { gte: startOfDay, lt: endOfDay },
      },
    });

    // Upcoming this week (next 7 days, not completed/cancelled/overdue)
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingThisWeek = await db.mSInstallationTask.findMany({
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        scheduledDate: { gte: now, lte: weekFromNow },
      },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
            clientName: true,
            siteAddress: true,
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Technician workload: for each assignedToName, count active tasks (PENDING + IN_PROGRESS + OVERDUE)
    const activeTasks = await db.mSInstallationTask.findMany({
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
        assignedToName: { not: null },
      },
      select: {
        assignedToName: true,
        id: true,
      },
    });

    const workloadMap = new Map<string, number>();
    for (const task of activeTasks) {
      const name = task.assignedToName!;
      workloadMap.set(name, (workloadMap.get(name) || 0) + 1);
    }

    const technicianWorkload: { name: string; activeTaskCount: number }[] = [];
    for (const [name, count] of workloadMap) {
      technicianWorkload.push({ name, activeTaskCount: count });
    }

    return NextResponse.json({
      totalPending,
      totalInProgress,
      totalOverdue,
      totalCompletedToday,
      upcomingThisWeek,
      technicianWorkload,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}