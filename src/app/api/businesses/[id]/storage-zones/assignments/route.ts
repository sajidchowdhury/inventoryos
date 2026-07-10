// GET/POST /api/businesses/[id]/storage-zones/assignments
// Manage which products live in which storage zones (a product can be in 2+ zones).
import { NextRequest, NextResponse } from "next/server";
import { setProductZoneAssignments } from "@/lib/scd";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const zoneId = url.searchParams.get("zoneId");

  try {
    const where: Record<string, string> = { businessId };
    if (productId) where.productId = productId;
    if (zoneId) where.zoneId = zoneId;

    const assignments = await db.productZoneAssignment.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, genericName: true, unit: true, rackNo: true },
        },
        zone: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    console.error("List zone assignments error:", error);
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  try {
    const body = await req.json();
    const productId = body.productId as string;
    const zoneIds = Array.isArray(body.zoneIds) ? body.zoneIds as string[] : [];

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const result = await setProductZoneAssignments(businessId, productId, zoneIds);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set zone assignments error:", error);
    return NextResponse.json({ error: "Failed to save assignments" }, { status: 500 });
  }
}
