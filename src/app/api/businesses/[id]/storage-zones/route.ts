// GET/POST /api/businesses/[id]/storage-zones
import { NextRequest, NextResponse } from "next/server";
import {
  createStorageZone,
  listStorageZones,
} from "@/lib/scd";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  try {
    const zones = await listStorageZones(businessId);
    return NextResponse.json({ success: true, zones });
  } catch (error) {
    console.error("List storage zones error:", error);
    return NextResponse.json({ error: "Failed to load storage zones" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Zone name is required" }, { status: 400 });
    }
    const zone = await createStorageZone(businessId, {
      name,
      color: body.color,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ success: true, zone }, { status: 201 });
  } catch (error) {
    console.error("Create storage zone error:", error);
    const msg = error instanceof Error ? error.message : "Failed to create zone";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A zone with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create zone" }, { status: 500 });
  }
}
