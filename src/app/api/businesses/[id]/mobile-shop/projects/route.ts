// GET/POST /api/businesses/[id]/mobile-shop/projects
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List projects with optional filters
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const sort = url.searchParams.get("sort")?.trim() || "createdAt:desc";

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { projectName: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { clientPhone: { contains: search, mode: "insensitive" } },
        { projectCode: { contains: search, mode: "insensitive" } },
      ];
    }

    // Parse sort parameter
    const [sortField, sortDir] = sort.split(":");
    const orderBy: Record<string, string> = {};
    if (sortField === "createdAt" || sortField === "projectName" || sortField === "deadline" || sortField === "projectValue" || sortField === "projectCode") {
      orderBy[sortField] = sortDir === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    const projects = await db.mSProject.findMany({
      where,
      include: {
        _count: {
          select: { surveys: true },
        },
      },
      orderBy,
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("List projects error:", error);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

// POST: Create a project
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      projectName,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      projectType,
      totalItems,
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
      projectType?: string;
      totalItems?: number;
      projectValue?: number;
      startDate?: string;
      deadline?: string;
      siteAddress?: string;
      siteContact?: string;
      siteContactPhone?: string;
      notes?: string;
      internalNotes?: string;
    };

    if (!projectName?.trim()) {
      return NextResponse.json({ error: "projectName is required" }, { status: 400 });
    }
    if (!clientName?.trim()) {
      return NextResponse.json({ error: "clientName is required" }, { status: 400 });
    }

    // Auto-generate projectCode: PRJ-001, PRJ-002, etc.
    const projectCount = await db.mSProject.count({
      where: { businessId, isActive: true },
    });
    const projectCode = `PRJ-${String(projectCount + 1).padStart(3, "0")}`;

    const project = await db.mSProject.create({
      data: {
        businessId,
        projectName: projectName.trim(),
        projectCode,
        clientName: clientName.trim(),
        clientPhone: clientPhone?.trim() || null,
        clientEmail: clientEmail?.trim() || null,
        clientAddress: clientAddress?.trim() || null,
        status: "PLANNING",
        projectType: projectType || "INSTALLATION",
        totalItems: totalItems || 0,
        projectValue: projectValue || 0,
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        siteAddress: siteAddress?.trim() || null,
        siteContact: siteContact?.trim() || null,
        siteContactPhone: siteContactPhone?.trim() || null,
        notes: notes?.trim() || null,
        internalNotes: internalNotes?.trim() || null,
        isActive: true,
      },
      include: {
        _count: {
          select: { surveys: true },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}