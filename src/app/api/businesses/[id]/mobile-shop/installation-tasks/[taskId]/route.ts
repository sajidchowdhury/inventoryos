// GET /api/businesses/[id]/mobile-shop/installation-tasks/[taskId] → single task
// PUT /api/businesses/[id]/mobile-shop/installation-tasks/[taskId] → update task
// DELETE /api/businesses/[id]/mobile-shop/installation-tasks/[taskId] → soft-delete
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── GET: Get single task with checklists ──────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id: businessId, taskId } = await params;

    const task = await db.mSInstallationTask.findFirst({
      where: { id: taskId, businessId, isActive: true },
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
    });

    if (!task) {
      return NextResponse.json({ error: "Installation task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: Update task fields ───────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id: businessId, taskId } = await params;
    const body = await req.json();

    const existing = await db.mSInstallationTask.findFirst({
      where: { id: taskId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Installation task not found" }, { status: 404 });
    }

    const {
      taskTitle,
      scheduledDate,
      assignedToId,
      assignedToName,
      location,
      priority,
      notes,
      internalNotes,
      status,
    } = body;

    const data: Record<string, unknown> = {};

    if (taskTitle !== undefined) data.taskTitle = taskTitle;
    if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (assignedToName !== undefined) data.assignedToName = assignedToName || null;
    if (location !== undefined) data.location = location || null;
    if (priority !== undefined) {
      const validPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
      data.priority = validPriorities.includes(priority) ? priority : existing.priority;
    }
    if (notes !== undefined) data.notes = notes || null;
    if (internalNotes !== undefined) data.internalNotes = internalNotes || null;

    if (status !== undefined) {
      data.status = status;
      // If status changed to COMPLETED, set completedDate to now
      if (status === "COMPLETED" && existing.status !== "COMPLETED") {
        data.completedDate = new Date();
      }
      // If status changed to IN_PROGRESS from PENDING, keep completedDate null
      if (status === "IN_PROGRESS" && existing.status === "PENDING") {
        data.completedDate = null;
      }
    }

    const updated = await db.mSInstallationTask.update({
      where: { id: taskId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete task ──────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id: businessId, taskId } = await params;

    const existing = await db.mSInstallationTask.findFirst({
      where: { id: taskId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Installation task not found" }, { status: 404 });
    }

    await db.mSInstallationTask.update({
      where: { id: taskId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}