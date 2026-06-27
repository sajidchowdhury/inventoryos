// GET /api/businesses/[id]/roles
// Returns all role definitions with permissions
import { NextRequest, NextResponse } from "next/server";
import { ROLE_DEFINITIONS, ALL_PERMISSIONS } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params; // businessId not needed for role definitions (they're global)

  return NextResponse.json({
    success: true,
    roles: Object.values(ROLE_DEFINITIONS),
    allPermissions: ALL_PERMISSIONS,
  });
}
