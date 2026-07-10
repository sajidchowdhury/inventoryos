// GET /api/businesses/[id]/cctv/installation-tasks/by-project/[projectId] → list by project
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; projectId: string }> }) {
  try {
    const { id: businessId, projectId } = await params;

    // Auto-update overdue before fetching
    const now = new Date();
    await db.cCTVInstallationTask.updateMany({
      where: {
        businessId,
        projectId,
        isActive: true,
        scheduledDate: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "OVERDUE" },
    });

    const tasks = await db.cCTVInstallationTask.findMany({
      where: {
        businessId,
        projectId,
        isActive: true,
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
        checklists: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    return NextResponse.json(tasks);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}