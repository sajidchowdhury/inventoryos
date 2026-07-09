// GET/POST /api/businesses/[id]/cctv/projects/[projectId]/surveys
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List surveys for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> },
) {
  try {
    const { id: businessId, projectId } = await params;

    // Verify project exists
    const project = await db.cCTVProject.findFirst({
      where: { id: projectId, businessId, isActive: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const surveys = await db.cCTVSiteSurvey.findMany({
      where: { projectId, businessId, isActive: true },
      include: {
        cameraPositions: {
          orderBy: { sortOrder: "asc" },
        },
        cableRoutes: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { surveyDate: "desc" },
    });

    return NextResponse.json(surveys);
  } catch (error) {
    console.error("List surveys error:", error);
    return NextResponse.json({ error: "Failed to list surveys" }, { status: 500 });
  }
}

// POST: Create a survey for a project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> },
) {
  try {
    const { id: businessId, projectId } = await params;

    // Verify project exists
    const project = await db.cCTVProject.findFirst({
      where: { id: projectId, businessId, isActive: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();

    const {
      floorPlanData,
      floorPlanName,
      surveyorName,
      notes,
    } = body as {
      floorPlanData?: string;
      floorPlanName?: string;
      surveyorName?: string;
      notes?: string;
    };

    const survey = await db.cCTVSiteSurvey.create({
      data: {
        businessId,
        projectId,
        floorPlanData: floorPlanData || null,
        floorPlanName: floorPlanName?.trim() || null,
        surveyDate: new Date(),
        surveyorName: surveyorName?.trim() || null,
        notes: notes?.trim() || null,
        isActive: true,
      },
      include: {
        cameraPositions: {
          orderBy: { sortOrder: "asc" },
        },
        cableRoutes: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    console.error("Create survey error:", error);
    return NextResponse.json({ error: "Failed to create survey" }, { status: 500 });
  }
}