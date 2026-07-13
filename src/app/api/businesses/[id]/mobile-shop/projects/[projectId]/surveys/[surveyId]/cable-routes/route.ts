// GET/POST/PUT/DELETE /api/businesses/[id]/mobile-shop/projects/[projectId]/surveys/[surveyId]/cable-routes
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List cable routes for a survey
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;

    const routes = await db.mSCableRoute.findMany({
      where: { surveyId, businessId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error("List cable routes error:", error);
    return NextResponse.json({ error: "Failed to list cable routes" }, { status: 500 });
  }
}

// POST: Create a cable route
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
      label,
      points,
      cableType,
      cableLength,
      notes,
      sortOrder,
    } = body as {
      label?: string;
      points?: string;
      cableType?: string;
      cableLength?: number;
      notes?: string;
      sortOrder?: number;
    };

    if (!label?.trim()) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    if (!points) {
      return NextResponse.json({ error: "points is required (JSON string)" }, { status: 400 });
    }

    // Validate that points is valid JSON
    try {
      const parsed = JSON.parse(points);
      if (!Array.isArray(parsed)) {
        return NextResponse.json({ error: "points must be a JSON array" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "points must be valid JSON" }, { status: 400 });
    }

    const route = await db.mSCableRoute.create({
      data: {
        businessId,
        surveyId,
        label: label.trim(),
        points,
        cableType: cableType || "Cat6",
        cableLength: cableLength || null,
        notes: notes?.trim() || null,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error("Create cable route error:", error);
    return NextResponse.json({ error: "Failed to create cable route" }, { status: 500 });
  }
}

// PUT: Update a cable route (body must include id)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; surveyId: string }> },
) {
  try {
    const { id: businessId, surveyId } = await params;
    const body = await req.json();

    const { id, label, points, cableType, cableLength, notes, sortOrder } = body as {
      id?: string;
      label?: string;
      points?: string;
      cableType?: string;
      cableLength?: number;
      notes?: string;
      sortOrder?: number;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required in request body" }, { status: 400 });
    }

    const existing = await db.mSCableRoute.findFirst({
      where: { id, surveyId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cable route not found" }, { status: 404 });
    }

    // Validate points if provided
    if (points !== undefined) {
      try {
        const parsed = JSON.parse(points);
        if (!Array.isArray(parsed)) {
          return NextResponse.json({ error: "points must be a JSON array" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "points must be valid JSON" }, { status: 400 });
      }
    }

    const route = await db.mSCableRoute.update({
      where: { id },
      data: {
        ...(label !== undefined && { label: label.trim() }),
        ...(points !== undefined && { points }),
        ...(cableType !== undefined && { cableType }),
        ...(cableLength !== undefined && { cableLength }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json(route);
  } catch (error) {
    console.error("Update cable route error:", error);
    return NextResponse.json({ error: "Failed to update cable route" }, { status: 500 });
  }
}

// DELETE: Hard-delete a cable route (body must include id)
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

    const existing = await db.mSCableRoute.findFirst({
      where: { id, surveyId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cable route not found" }, { status: 404 });
    }

    await db.mSCableRoute.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete cable route error:", error);
    return NextResponse.json({ error: "Failed to delete cable route" }, { status: 500 });
  }
}