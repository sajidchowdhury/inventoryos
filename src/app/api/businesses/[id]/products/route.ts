// GET/POST /api/businesses/[id]/products
// GET: List products with search & filters
// POST: Create a new product
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureScdProductSummary } from "@/lib/scd";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const type = url.searchParams.get("type") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, isActive: true };
    if (category) where.categoryId = category;
    if (type) where.productType = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { genericName: { contains: search } },
        { manufacturer: { contains: search } },
        { barcode: { contains: search } },
        { rackNo: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          inventory: true,
          batches: {
            where: { status: "active" },
            select: { id: true, batchNo: true, expiryDate: true, quantity: true },
            orderBy: { expiryDate: "asc" },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Shelf-scanner quick-add: link to an existing master row, or create one so
    // the medicine appears in both the national catalog and this pharmacy's list.
    let masterProductId: string | null = body.masterProductId || null;
    if (!masterProductId && body.addToMasterCatalog !== false) {
      const name = String(body.name || "").trim();
      if (name) {
        // TODO (Phase 2A): restore mode:"insensitive" for case-insensitive name match.
        // It was removed temporarily during the SQLite-to-PostgreSQL migration.
        // See InventoryOS_Architecture_Roadmap.docx Problem 2.
        const existingMaster = await db.masterProduct.findFirst({
          where: {
            isActive: true,
            name: { equals: name },
          },
        });
        if (existingMaster) {
          masterProductId = existingMaster.id;
        } else {
          let manufacturerId: string | null = null;
          const manufacturer = body.manufacturer ? String(body.manufacturer).trim() : null;
          if (manufacturer) {
            const mfr = await db.masterManufacturer.upsert({
              where: { name: manufacturer },
              update: {},
              create: { name: manufacturer },
            });
            manufacturerId = mfr.id;
          }
          const createdMaster = await db.masterProduct.create({
            data: {
              name,
              genericName: body.genericName || null,
              strength: body.strength || null,
              dosageForm: body.dosageForm || null,
              manufacturerId,
              manufacturerStr: manufacturer,
              defaultMrp: body.mrp || body.sellingPrice || null,
              unit: body.unit || "piece",
            },
          });
          masterProductId = createdMaster.id;
        }
      }
    }

    const product = await db.product.create({
      data: {
        businessId,
        categoryId: body.categoryId || null,
        name: body.name,
        genericName: body.genericName || null,
        sku: body.sku || null,
        barcode: body.barcode || null,
        productType: body.productType || "medicine",
        unit: body.unit || "piece",
        stripSize: body.stripSize || null,
        boxSize: body.boxSize || null,
        strength: body.strength || null,
        dosageForm: body.dosageForm || null,
        manufacturer: body.manufacturer || null,
        scheduleType: body.scheduleType || null,
        hsnCode: body.hsnCode || null,
        vatRate: body.vatRate || 0,
        mrp: body.mrp || null,
        masterProductId,
        sellingPrice: body.sellingPrice || body.mrp || null,
        isPrescription: body.isPrescription || false,
        storageCondition: body.storageCondition || null,
        rackNo: body.rackNo || null,
        minStock: body.minStock || 0,
        maxStock: body.maxStock || 0,
        reorderLevel: body.reorderLevel || 0,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    // Create inventory record
    await db.inventory.create({
      data: {
        businessId,
        productId: product.id,
        quantity: 0,
        minStock: body.minStock || 0,
        unitCost: null,
      },
    });

    // If a Stock Count Day is active, include this product in summaries
    try {
      await ensureScdProductSummary(businessId, product.id);
    } catch (scdErr) {
      console.error("SCD summary for new product:", scdErr);
    }

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
