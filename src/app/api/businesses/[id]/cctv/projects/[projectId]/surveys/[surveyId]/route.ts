// GET/PUT/DELETE /api/businesses/[id]/cctv/projects/[projectId]/surveys/[surveyId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Single survey detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;

    const survey = await db.mSSiteSurvey.findFirst({
      where: { id: surveyId, businessId, isActive: true },
      include: {
        cameraPositions: {
          orderBy: { sortOrder: "asc" },
        },
        cableRoutes: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    return NextResponse.json(survey);
  } catch (error) {
    console.error("Get survey error:", error);
    return NextResponse.json({ error: "Failed to get survey" }, { status: 500 });
  }
}

// PUT: Update a survey
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;

    const existing = await db.mSSiteSurvey.findFirst({
      where: { id: surveyId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
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

    const survey = await db.mSSiteSurvey.update({
      where: { id: surveyId },
      data: {
        ...(floorPlanData !== undefined && { floorPlanData }),
        ...(floorPlanName !== undefined && { floorPlanName: floorPlanName?.trim() || null }),
        ...(surveyorName !== undefined && { surveyorName: surveyorName?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
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

    return NextResponse.json(survey);
  } catch (error) {
    console.error("Update survey error:", error);
    return NextResponse.json({ error: "Failed to update survey" }, { status: 500 });
  }
}

// DELETE: Soft-delete a survey
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;

    const existing = await db.mSSiteSurvey.findFirst({
      where: { id: surveyId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    await db.mSSiteSurvey.update({
      where: { id: surveyId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete survey error:", error);
    return NextResponse.json({ error: "Failed to delete survey" }, { status: 500 });
  }
}