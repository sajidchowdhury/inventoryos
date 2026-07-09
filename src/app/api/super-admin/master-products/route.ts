// GET /api/super-admin/master-products — search + paginate
// POST /api/super-admin/master-products — create single product

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "./_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const manufacturer = searchParams.get("manufacturer") || "";
    const category = searchParams.get("category") || "";
    const dosageForm = searchParams.get("dosageForm") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: any = { isActive: true };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { genericName: { contains: q } },
        { manufacturerStr: { contains: q } },
        { barcode: { contains: q } },
      ];
    }
    if (manufacturer) where.manufacturerStr = { contains: manufacturer };
    if (category) where.categoryName = category;
    if (dosageForm) where.dosageForm = dosageForm;

    const [products, total] = await Promise.all([
      db.masterProduct.findMany({ where, orderBy: { name: "asc" }, take: limit, skip: offset }),
      db.masterProduct.count({ where }),
    ]);

    return NextResponse.json({ success: true, products, total, limit, offset });
  } catch (error) {
    console.error("[master-products] GET failed:", error);
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, genericName, strength, dosageForm, manufacturer, categoryName, defaultMrp, unit, stripSize, boxSize, barcode } = body;

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    // Find or create manufacturer
    let manufacturerId: string | null = null;
    if (manufacturer) {
      const mfr = await db.masterManufacturer.upsert({
        where: { name: manufacturer },
        update: {},
        create: { name: manufacturer },
      });
      manufacturerId = mfr.id;
    }

    const product = await db.masterProduct.create({
      data: {
        name, genericName: genericName || null, strength: strength || null,
        dosageForm: dosageForm || null, manufacturerId, manufacturerStr: manufacturer || null,
        categoryName: categoryName || null, defaultMrp: defaultMrp || null,
        unit: unit || "piece", stripSize: stripSize || null, boxSize: boxSize || null,
        barcode: barcode || null,
      },
    });

    // Update manufacturer product count
    if (manufacturerId) {
      const count = await db.masterProduct.count({ where: { manufacturerId } });
      await db.masterManufacturer.update({ where: { id: manufacturerId }, data: { productCount: count } });
    }

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("[master-products] POST failed:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
