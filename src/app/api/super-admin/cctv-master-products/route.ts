// GET /api/super-admin/cctv-master-products — list + search CCTV master catalog
// POST /api/super-admin/cctv-master-products — create a new CCTV master product

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../master-products/_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const brand = searchParams.get("brand") || "";
    const category = searchParams.get("category") || "";
    const approved = searchParams.get("approved"); // "true" | "false" | null (all)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { hsnCode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (brand) where.brand = { contains: brand, mode: "insensitive" };
    if (category) where.defaultCategoryName = { contains: category, mode: "insensitive" };
    if (approved === "true") where.isApproved = true;
    else if (approved === "false") where.isApproved = false;

    const [products, total] = await Promise.all([
      db.cCTVMasterProduct.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        include: {
          manufacturer: { select: { id: true, name: true } },
        },
      }),
      db.cCTVMasterProduct.count({ where }),
    ]);

    return NextResponse.json({ success: true, products, total, limit, offset });
  } catch (error) {
    console.error("[cctv-master-products] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch CCTV master products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, brand, model, sku, description, hsnCode,
      defaultCategoryName, defaultWarrantyMonths, defaultSerialTracked,
      defaultUnit, defaultImageUrl, defaultVatRate, defaultMrp,
      manufacturer,
    } = body;

    if (!name || !brand || !model) {
      return NextResponse.json(
        { error: "name, brand, and model are required" },
        { status: 400 }
      );
    }

    // Check for duplicate (brand, model) — the unique constraint
    const existing = await db.cCTVMasterProduct.findUnique({
      where: { brand_model: { brand, model } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A master product with brand "${brand}" and model "${model}" already exists` },
        { status: 409 }
      );
    }

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

    const product = await db.cCTVMasterProduct.create({
      data: {
        name,
        brand,
        model,
        sku: sku || null,
        description: description || null,
        hsnCode: hsnCode || null,
        defaultCategoryName: defaultCategoryName || null,
        defaultWarrantyMonths: defaultWarrantyMonths ?? 0,
        defaultSerialTracked: defaultSerialTracked ?? false,
        defaultUnit: defaultUnit || "piece",
        defaultImageUrl: defaultImageUrl || null,
        defaultVatRate: defaultVatRate ?? 0,
        defaultMrp: defaultMrp || null,
        manufacturerId,
        isApproved: true, // Admin-created products are auto-approved
      },
      include: {
        manufacturer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("[cctv-master-products] POST failed:", error);
    return NextResponse.json({ error: "Failed to create CCTV master product" }, { status: 500 });
  }
}
