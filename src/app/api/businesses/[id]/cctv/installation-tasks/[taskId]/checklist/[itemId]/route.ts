// PUT /api/businesses/[id]/cctv/installation-tasks/[taskId]/checklist/[itemId] → update item
// DELETE /api/businesses/[id]/cctv/installation-tasks/[taskId]/checklist/[itemId] → soft-delete item
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── PUT: Update single checklist item ─────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string; itemId: string }> }
) {
  try {
    const { id: businessId, taskId, itemId } = await params;
    const body = await req.json();

    const { itemText, isCompleted, notes } = body;

    // Verify checklist item exists and belongs to task/business
    const existing = await db.mSTaskChecklist.findFirst({
      where: { id: itemId, taskId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (itemText !== undefined) updateData.itemText = itemText;
    if (notes !== undefined) updateData.notes = notes || null;

    // Handle isCompleted changes
    if (isCompleted !== undefined && isCompleted !== existing.isCompleted) {
      updateData.isCompleted = isCompleted;

      if (isCompleted && !existing.isCompleted) {
        // false → true
        updateData.completedAt = new Date();
        // Increment parent completedChecklist
        await db.mSInstallationTask.update({
          where: { id: taskId },
          data: { completedChecklist: { increment: 1 } },
        });
      } else if (!isCompleted && existing.isCompleted) {
        // true → false
        updateData.completedAt = null;
        // Decrement parent completedChecklist (floor 0)
        const parent = await db.mSInstallationTask.findUnique({
          where: { id: taskId },
          select: { completedChecklist: true },
        });
        const newCompleted = Math.max(0, (parent?.completedChecklist ?? 0) - 1);
        await db.mSInstallationTask.update({
          where: { id: taskId },
          data: { completedChecklist: newCompleted },
        });
      }
    }

    const updated = await db.mSTaskChecklist.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete checklist item ────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string; itemId: string }> }
) {
  try {
    const { id: businessId, taskId, itemId } = await params;

    // Verify checklist item exists
    const existing = await db.mSTaskChecklist.findFirst({
      where: { id: itemId, taskId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    // Soft-delete the item
    await db.mSTaskChecklist.update({
      where: { id: itemId },
      data: { isActive: false },
    });

    // Decrement parent totalChecklist
    const parent = await db.mSInstallationTask.findUnique({
      where: { id: taskId },
      select: { totalChecklist: true, completedChecklist: true },
    });

    const newTotal = Math.max(0, (parent?.totalChecklist ?? 0) - 1);
    let newCompleted = parent?.completedChecklist ?? 0;

    // If was completed, also decrement completedChecklist
    if (existing.isCompleted) {
      newCompleted = Math.max(0, newCompleted - 1);
    }

    await db.mSInstallationTask.update({
      where: { id: taskId },
      data: {
        totalChecklist: newTotal,
        completedChecklist: newCompleted,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}