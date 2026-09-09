// POST /api/businesses/[id]/cctv/products/import
// Action 'parse': parse CSV text, validate rows, return preview
// Action 'import': import validated rows into database
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

interface CSVRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  status: "valid" | "warning" | "error";
}

// Simple CSV parser
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map(parseCSVLine);
}

function validateRow(headers: string[], values: string[], rowIndex: number): CSVRow {
  const data: Record<string, string> = {};
  headers.forEach((h, i) => { data[h] = values[i] || ""; });

  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.name) errors.push("Name is required");
  if (!data.brand) errors.push("Brand is required");
  if (!data.costPrice) errors.push("Cost price is required");
  if (!data.sellingPrice) errors.push("Selling price is required");

  // Numeric validation
  if (data.costPrice && isNaN(parseFloat(data.costPrice))) errors.push("Cost price must be a number");
  if (data.sellingPrice && isNaN(parseFloat(data.sellingPrice))) errors.push("Selling price must be a number");
  if (data.stock && isNaN(parseInt(data.stock))) warnings.push("Stock is not a number, defaulting to 0");
  if (data.warrantyMonths && isNaN(parseInt(data.warrantyMonths))) warnings.push("Warranty months is not a number");

  // I-9: Reject negative numeric inputs. Previously `parseInt(row.data.stock) || 0`
  // accepted stock="-5" → -5, allowing a CSV import to seed negative inventory.
  // Same for minStock and warrantyMonths. Negative cost/sell prices are also
  // nonsensical for a CCTV shop.
  if (data.costPrice && !isNaN(parseFloat(data.costPrice)) && parseFloat(data.costPrice) < 0) {
    errors.push("Cost price must be ≥ 0");
  }
  if (data.sellingPrice && !isNaN(parseFloat(data.sellingPrice)) && parseFloat(data.sellingPrice) < 0) {
    errors.push("Selling price must be ≥ 0");
  }
  if (data.stock && !isNaN(parseInt(data.stock)) && parseInt(data.stock) < 0) {
    errors.push("Stock must be ≥ 0");
  }
  if (data.lowStockAlert && !isNaN(parseInt(data.lowStockAlert)) && parseInt(data.lowStockAlert) < 0) {
    errors.push("Low stock alert must be ≥ 0");
  }
  if (data.warrantyMonths && !isNaN(parseInt(data.warrantyMonths)) && parseInt(data.warrantyMonths) < 0) {
    errors.push("Warranty months must be ≥ 0");
  }

  // Warning for missing optional fields
  if (!data.category) warnings.push("No category specified");

  let status: "valid" | "warning" | "error" = "valid";
  if (errors.length > 0) status = "error";
  else if (warnings.length > 0) status = "warning";

  return { rowIndex, data, errors, warnings, status };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  // Applies to both 'parse' (preview) and 'import' actions — a read-only
  // business shouldn't be preparing imports either, since they can't execute.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  // ── PARSE action ──
  if (body.action === "parse") {
    const csvText: string = body.csvText;
    if (!csvText) {
      return NextResponse.json({ error: "CSV text is required" }, { status: 400 });
    }

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    const validatedRows: CSVRow[] = dataRows.map((values, i) => validateRow(headers, values, i + 1));

    return NextResponse.json({
      success: true,
      rows: validatedRows,
      totalRows: validatedRows.length,
      validCount: validatedRows.filter(r => r.status === "valid").length,
      warningCount: validatedRows.filter(r => r.status === "warning").length,
      errorCount: validatedRows.filter(r => r.status === "error").length,
    });
  }

  // ── IMPORT action ──
  if (body.action === "import") {
    const rows: CSVRow[] = body.rows;
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Rows are required" }, { status: 400 });
    }

    // Only import valid + warning rows
    const importable = rows.filter(r => r.status !== "error");

    // Get or create categories
    const categoryMap: Record<string, string> = {};
    for (const row of importable) {
      const catName = row.data.category;
      if (catName && !categoryMap[catName]) {
        let cat = await db.cCTVCategory.findFirst({
          where: { businessId, name: { equals: catName, mode: "insensitive" } },
        });
        if (!cat) {
          cat = await db.cCTVCategory.create({
            data: {
              businessId,
              name: catName,
              slug: catName.toLowerCase().replace(/\s+/g, "-"),
              icon: "Package",
              color: "#7c3aed",
            },
          });
        }
        categoryMap[catName] = cat.id;
      }
    }

    let importedCount = 0;
    let skippedCount = 0;
    let masterCatalogLinked = 0;

    for (const row of importable) {
      try {
        // I-8: Check if product already exists (case-insensitive name + brand).
        // Previously `name: row.data.name, brand: row.data.brand` was an
        // EXACT match — "hikvision DS-2CD" did not collide with "Hikvision
        // DS-2CD" so the import created a duplicate product. Now both
        // sides use mode: insensitive.
        const existingProduct = await db.cCTVProduct.findFirst({
          where: {
            businessId,
            name: { equals: row.data.name, mode: "insensitive" },
            brand: { equals: row.data.brand, mode: "insensitive" },
          },
        });

        if (existingProduct) {
          skippedCount++;
          continue;
        }

        // Check master catalog for matching product (by brand + model or name)
        let masterProductId = null;
        const masterMatch = await db.masterProduct.findFirst({
          where: {
            OR: [
              {
                brand: row.data.brand,
                model: row.data.model || undefined,
              },
              {
                name: { contains: row.data.name, mode: "insensitive" },
              },
            ],
          },
          select: { id: true },
        });
        if (masterMatch) {
          masterProductId = masterMatch.id;
          masterCatalogLinked++;
        }

        // I-9 (defense in depth): clamp any negative numeric inputs to 0
        // even if they slip past validateRow (e.g. a hand-edited `rows`
        // payload POSTed directly to this endpoint). Negative stock or
        // prices in the DB would corrupt every downstream report.
        const clampInt = (v: string | undefined, fallback = 0) => {
          const n = parseInt(v || "");
          return Number.isFinite(n) && n > 0 ? n : fallback;
        };
        const clampFloat = (v: string | undefined, fallback = 0) => {
          const n = parseFloat(v || "");
          return Number.isFinite(n) && n > 0 ? n : fallback;
        };

        await db.cCTVProduct.create({
          data: {
            businessId,
            categoryId: row.data.category ? categoryMap[row.data.category] : null,
            name: row.data.name,
            brand: row.data.brand,
            model: row.data.model || null,
            sku: row.data.sku || null,
            costPrice: clampFloat(row.data.costPrice),
            sellPrice: clampFloat(row.data.sellingPrice),
            stock: clampInt(row.data.stock),
            minStock: clampInt(row.data.lowStockAlert),
            warrantyMonths: clampInt(row.data.warrantyMonths),
            serialTracked: row.data.serialTracked === "true" || row.data.serialTracked === "1",
            unit: row.data.unit || "piece",
          },
        });
        importedCount++;
      } catch (err) {
        console.error("[import] Failed to create product:", err);
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      masterCatalogLinked,
    });
  }

  return NextResponse.json({ error: "Unknown action. Use 'parse' or 'import'." }, { status: 400 });
}
