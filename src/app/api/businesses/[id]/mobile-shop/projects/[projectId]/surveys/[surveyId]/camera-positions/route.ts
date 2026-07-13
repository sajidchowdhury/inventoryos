// GET/POST/PUT/DELETE /api/businesses/[id]/mobile-shop/projects/[projectId]/surveys/[surveyId]/camera-positions
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List camera positions for a survey
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;

    const positions = await db.mSCameraPosition.findMany({
      where: { surveyId, businessId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error("List camera positions error:", error);
    return NextResponse.json({ error: "Failed to list camera positions" }, { status: 500 });
  }
}

// POST: Create a camera position
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;

    // Verify survey exists
    const survey = await db.mSSiteSurvey.findFirst({
      where: { id: surveyId, businessId, isActive: true },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const body = await req.json();

    const {
      posX,
      posY,
      label,
      cameraType,
      resolution,
      notes,
      sortOrder,
    } = body as {
      posX?: number;
      posY?: number;
      label?: string;
      cameraType?: string;
      resolution?: string;
      notes?: string;
      sortOrder?: number;
    };

    if (posX == null || posY == null) {
      return NextResponse.json({ error: "posX and posY are required" }, { status: 400 });
    }

    if (posX < 0 || posX > 100 || posY < 0 || posY > 100) {
      return NextResponse.json({ error: "posX and posY must be between 0 and 100" }, { status: 400 });
    }

    if (!label?.trim()) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const position = await db.mSCameraPosition.create({
      data: {
        businessId,
        surveyId,
        posX,
        posY,
        label: label.trim(),
        cameraType: cameraType || "Bullet",
        resolution: resolution?.trim() || null,
        notes: notes?.trim() || null,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error("Create camera position error:", error);
    return NextResponse.json({ error: "Failed to create camera position" }, { status: 500 });
  }
}

// PUT: Update a camera position (body must include id)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;
    const body = await req.json();

    const { id, posX, posY, label, cameraType, resolution, notes, sortOrder } = body as {
      id?: string;
      posX?: number;
      posY?: number;
      label?: string;
      cameraType?: string;
      resolution?: string;
      notes?: string;
      sortOrder?: number;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required in request body" }, { status: 400 });
    }

    const existing = await db.mSCameraPosition.findFirst({
      where: { id, surveyId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Camera position not found" }, { status: 404 });
    }

    if (posX != null && (posX < 0 || posX > 100)) {
      return NextResponse.json({ error: "posX must be between 0 and 100" }, { status: 400 });
    }

    if (posY != null && (posY < 0 || posY > 100)) {
      return NextResponse.json({ error: "posY must be between 0 and 100" }, { status: 400 });
    }

    const position = await db.mSCameraPosition.update({
      where: { id },
      data: {
        ...(posX !== undefined && { posX }),
        ...(posY !== undefined && { posY }),
        ...(label !== undefined && { label: label.trim() }),
        ...(cameraType !== undefined && { cameraType }),
        ...(resolution !== undefined && { resolution: resolution?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json(position);
  } catch (error) {
    console.error("Update camera position error:", error);
    return NextResponse.json({ error: "Failed to update camera position" }, { status: 500 });
  }
}

// DELETE: Hard-delete a camera position (body must include id)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;
    const body = await req.json();

    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "id is required in request body" }, { status: 400 });
    }

    const existing = await db.mSCameraPosition.findFirst({
      where: { id, surveyId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Camera position not found" }, { status: 404 });
    }

    await db.mSCameraPosition.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete camera position error:", error);
    return NextResponse.json({ error: "Failed to delete camera position" }, { status: 500 });
  }
}