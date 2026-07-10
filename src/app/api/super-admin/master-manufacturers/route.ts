// GET /api/super-admin/master-manufacturers — list with product counts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../master-products/_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const where: any = {};
    if (q) where.name = { contains: q };

    const manufacturers = await db.masterManufacturer.findMany({
      where,
      orderBy: { productCount: "desc" },
    });

    return NextResponse.json({ success: true, manufacturers, total: manufacturers.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load manufacturers" }, { status: 500 });
  }
}
