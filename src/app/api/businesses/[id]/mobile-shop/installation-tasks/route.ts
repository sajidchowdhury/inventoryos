// GET /api/businesses/[id]/mobile-shop/installation-tasks → list (with overdue auto-update)
// POST /api/businesses/[id]/mobile-shop/installation-tasks → create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── GET: List installation tasks ──────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);

    const status = url.searchParams.get("status")?.trim() || "";
    const projectId = url.searchParams.get("projectId")?.trim() || "";
    const assignedToId = url.searchParams.get("assignedToId")?.trim() || "";
    const dateFrom = url.searchParams.get("dateFrom")?.trim() || "";
    const dateTo = url.searchParams.get("dateTo")?.trim() || "";

    // Auto-update overdue: scheduledDate < now AND status is PENDING or IN_PROGRESS → OVERDUE
    const now = new Date();
    await db.mSInstallationTask.updateMany({
      where: {
        businessId,
        isActive: true,
        scheduledDate: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "OVERDUE" },
    });

    // Build where clause
    const where: Record<string, unknown> = {
      businessId,
      isActive: true,
    };

    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (assignedToId) where.assignedToId = assignedToId;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.scheduledDate = dateFilter;
    }

    const tasks = await db.mSInstallationTask.findMany({
      where,
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
        _count: {
          select: { checklists: true },
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

// ── POST: Create installation task ────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      projectId,
      taskTitle,
      scheduledDate,
      assignedToId,
      assignedToName,
      location,
      siteAddress,
      priority,
      notes,
      internalNotes,
      checklistItems,
    } = body;

    // Validate required fields
    if (!projectId || !taskTitle || !scheduledDate) {
      return NextResponse.json(
        { error: "projectId, taskTitle, and scheduledDate are required" },
        { status: 400 }
      );
    }

    const validPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    const taskPriority = priority && validPriorities.includes(priority) ? priority : "NORMAL";

    const checklistItemsArray: string[] = Array.isArray(checklistItems) ? checklistItems : [];

    // Create the task
    const task = await db.mSInstallationTask.create({
      data: {
        businessId,
        projectId,
        taskTitle,
        scheduledDate: new Date(scheduledDate),
        assignedToId: assignedToId || null,
        assignedToName: assignedToName || null,
        location: location || null,
        siteAddress: siteAddress || null,
        priority: taskPriority,
        notes: notes || null,
        internalNotes: internalNotes || null,
        totalChecklist: checklistItemsArray.length,
        completedChecklist: 0,
        status: "PENDING",
      },
    });

    // Create checklist items if provided
    if (checklistItemsArray.length > 0) {
      await db.mSTaskChecklist.createMany({
        data: checklistItemsArray.map((item: string, index: number) => ({
          businessId,
          taskId: task.id,
          itemText: item,
          sortOrder: index,
          isActive: true,
        })),
      });
    }

    // Return the created task with full data
    const created = await db.mSInstallationTask.findUnique({
      where: { id: task.id },
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
        _count: { select: { checklists: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}