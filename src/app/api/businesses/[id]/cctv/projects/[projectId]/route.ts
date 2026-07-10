// GET/PUT/DELETE /api/businesses/[id]/cctv/projects/[projectId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Single project detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> },
) {
  try {
    const { id: businessId, projectId } = await params;

    const project = await db.cCTVProject.findFirst({
      where: { id: projectId, businessId, isActive: true },
      include: {
        _count: {
          select: { surveys: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json({ error: "Failed to get project" }, { status: 500 });
  }
}

// PUT: Update a project
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> },
) {
  try {
    const { id: businessId, projectId } = await params;
    const body = await req.json();

    const existing = await db.cCTVProject.findFirst({
      where: { id: projectId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const {
      projectName,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      status,
      projectType,
      totalItems,
      completedItems,
      projectValue,
      startDate,
      deadline,
      siteAddress,
      siteContact,
      siteContactPhone,
      notes,
      internalNotes,
    } = body as {
      projectName?: string;
      clientName?: string;
      clientPhone?: string;
      clientEmail?: string;
      clientAddress?: string;
      status?: string;
      projectType?: string;
      totalItems?: number;
      completedItems?: number;
      projectValue?: number;
      startDate?: string;
      deadline?: string;
      siteAddress?: string;
      siteContact?: string;
      siteContactPhone?: string;
      notes?: string;
      internalNotes?: string;
    };

    // If status is changing to COMPLETED, auto-set completedAt
    let completedAt: Date | null | undefined = undefined;
    if (status === "COMPLETED" && existing.status !== "COMPLETED") {
      completedAt = new Date();
    } else if (status && status !== "COMPLETED") {
      completedAt = null;
    }

    const project = await db.cCTVProject.update({
      where: { id: projectId },
      data: {
        ...(projectName !== undefined && { projectName: projectName.trim() }),
        ...(clientName !== undefined && { clientName: clientName.trim() }),
        ...(clientPhone !== undefined && { clientPhone: clientPhone?.trim() || null }),
        ...(clientEmail !== undefined && { clientEmail: clientEmail?.trim() || null }),
        ...(clientAddress !== undefined && { clientAddress: clientAddress?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(projectType !== undefined && { projectType }),
        ...(totalItems !== undefined && { totalItems }),
        ...(completedItems !== undefined && { completedItems }),
        ...(projectValue !== undefined && { projectValue }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(siteAddress !== undefined && { siteAddress: siteAddress?.trim() || null }),
        ...(siteContact !== undefined && { siteContact: siteContact?.trim() || null }),
        ...(siteContactPhone !== undefined && { siteContactPhone: siteContactPhone?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(internalNotes !== undefined && { internalNotes: internalNotes?.trim() || null }),
        ...(completedAt !== undefined && { completedAt }),
      },
      include: {
        _count: {
          select: { surveys: true },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE: Soft-delete a project
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> },
) {
  try {
    const { id: businessId, projectId } = await params;

    const existing = await db.cCTVProject.findFirst({
      where: { id: projectId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db.cCTVProject.update({
      where: { id: projectId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}