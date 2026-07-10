// GET /api/businesses/[id]/cctv/installation-tasks/[taskId]/checklist → list items
// POST /api/businesses/[id]/cctv/installation-tasks/[taskId]/checklist → add item
// PUT /api/businesses/[id]/cctv/installation-tasks/[taskId]/checklist → bulk update
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── GET: List checklist items for a task ──────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id: businessId, taskId } = await params;

    // Verify task exists
    const task = await db.cCTVInstallationTask.findFirst({
      where: { id: taskId, businessId, isActive: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Installation task not found" }, { status: 404 });
    }

    const items = await db.cCTVTaskChecklist.findMany({
      where: { taskId, businessId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(items);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Add a checklist item to a task ──────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id: businessId, taskId } = await params;
    const body = await req.json();

    const { itemText, notes, sortOrder, isCompleted } = body;

    if (!itemText) {
      return NextResponse.json({ error: "itemText is required" }, { status: 400 });
    }

    // Verify task exists
    const task = await db.cCTVInstallationTask.findFirst({
      where: { id: taskId, businessId, isActive: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Installation task not found" }, { status: 404 });
    }

    // Determine sort order
    const maxSort = await db.cCTVTaskChecklist.findFirst({
      where: { taskId, businessId, isActive: true },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const nextSort = sortOrder !== undefined ? sortOrder : (maxSort ? maxSort.sortOrder + 1 : 0);
    const completed = isCompleted === true;
    const completedAt = completed ? new Date() : null;

    // Create checklist item
    const item = await db.cCTVTaskChecklist.create({
      data: {
        businessId,
        taskId,
        itemText,
        isCompleted: completed,
        sortOrder: nextSort,
        notes: notes || null,
        completedAt,
        isActive: true,
      },
    });

    // Update parent task counters
    const updateData: Record<string, unknown> = {
      totalChecklist: { increment: 1 },
    };
    if (completed) {
      updateData.completedChecklist = { increment: 1 };
    }

    await db.cCTVInstallationTask.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: Bulk update checklist items ──────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id: businessId, taskId } = await params;
    const body = await req.json();

    const items: { id: string; isCompleted: boolean; notes?: string }[] = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "An array of { id, isCompleted, notes? } is required" }, { status: 400 });
    }

    // Verify task exists
    const task = await db.cCTVInstallationTask.findFirst({
      where: { id: taskId, businessId, isActive: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Installation task not found" }, { status: 404 });
    }

    // Process each item
    for (const item of items) {
      const existing = await db.cCTVTaskChecklist.findFirst({
        where: { id: item.id, taskId, businessId, isActive: true },
      });

      if (!existing) continue;

      const updateData: Record<string, unknown> = {
        isCompleted: item.isCompleted,
      };

      if (item.notes !== undefined) {
        updateData.notes = item.notes || null;
      }

      // Handle completion status change
      if (!existing.isCompleted && item.isCompleted) {
        // false → true
        updateData.completedAt = new Date();
      } else if (existing.isCompleted && !item.isCompleted) {
        // true → false
        updateData.completedAt = null;
      }

      await db.cCTVTaskChecklist.update({
        where: { id: item.id },
        data: updateData,
      });
    }

    // Recount totals on parent task
    const [totalCount, completedCount] = await Promise.all([
      db.cCTVTaskChecklist.count({
        where: { taskId, businessId, isActive: true },
      }),
      db.cCTVTaskChecklist.count({
        where: { taskId, businessId, isActive: true, isCompleted: true },
      }),
    ]);

    await db.cCTVInstallationTask.update({
      where: { id: taskId },
      data: {
        totalChecklist: totalCount,
        completedChecklist: completedCount,
      },
    });

    return NextResponse.json({ success: true, totalChecklist: totalCount, completedChecklist: completedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}