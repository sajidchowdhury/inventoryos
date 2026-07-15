// POST /api/businesses/[id]/mobile-shop/products/import
// Phase 7: CSV Product Import — Parse, Validate, Preview, Execute
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── Types ──

interface CSVRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  status: "valid" | "warning" | "error";
}

interface ImportResult {
  rows: CSVRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
}

interface CategoryMap {
  [name: string]: string | null; // categoryName → categoryId
}

// ── CSV Parser (simple, no external dependency) ──

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        current.push(field);
        field = "";
        lines.push(current);
        current = [];
        i++; // skip \n
      } else if (ch === "\n" || ch === "\r") {
        current.push(field);
        field = "";
        lines.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }

  // Last field/line
  if (field || current.length > 0) {
    current.push(field);
    lines.push(current);
  }

  return lines;
}

// ── Validators ──

function validateRow(
  row: string[],
  headers: string[],
  rowIndex: number,
  categories: CategoryMap,
  existingSKUs: Set<string>
): CSVRow {
  const obj: Record<string, string> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  // Map headers to values
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i].trim().toLowerCase();
    const val = (row[i] || "").trim();
    obj[key] = val;
  }

  const name = obj["name"] || "";
  const sku = obj["sku"] || "";
  const category = obj["category"] || "";
  const brand = obj["brand"] || "";
  const unit = obj["unit"] || "piece";
  const costPrice = obj["costprice"] || "0";
  const sellingPrice = obj["sellingprice"] || "0";
  const stock = obj["stock"] || "0";
  const lowStockAlert = obj["lowstockalert"] || "0";
  const warrantyMonths = obj["warrantymonths"] || "0";
  const description = obj["description"] || "";

  // Required: name
  if (!name) {
    errors.push("Product name is required");
  } else if (name.length > 200) {
    errors.push("Product name too long (max 200 chars)");
  }

  // Brand required
  if (!brand) {
    errors.push("Brand is required");
  }

  // Cost price
  const cp = parseFloat(costPrice);
  if (isNaN(cp) || cp < 0) {
    errors.push("costPrice must be a valid number >= 0");
  }

  // Selling price
  const sp = parseFloat(sellingPrice);
  if (isNaN(sp) || sp < 0) {
    errors.push("sellingPrice must be a valid number >= 0");
  }

  // Stock
  const st = parseInt(stock, 10);
  if (isNaN(st) || st < 0) {
    errors.push("stock must be a non-negative integer");
  }

  // Low stock alert
  const lsa = parseInt(lowStockAlert, 10);
  if (isNaN(lsa) || lsa < 0) {
    warnings.push("lowStockAlert must be a non-negative integer (defaulting to 0)");
  }

  // Warranty
  const wm = parseInt(warrantyMonths, 10);
  if (isNaN(wm) || wm < 0) {
    warnings.push("warrantyMonths must be a non-negative integer (defaulting to 0)");
  }

  // SKU duplicate check
  if (sku && existingSKUs.has(sku.toLowerCase())) {
    errors.push(`Duplicate SKU "${sku}" already exists in file`);
  }
  if (sku) existingSKUs.add(sku.toLowerCase());

  // Category validation (warning only — we'll create if missing)
  if (category && !categories[category.toLowerCase()]) {
    warnings.push(`Category "${category}" not found — will be created`);
  }

  // Unit
  const validUnits = ["piece", "box", "pair", "set", "roll", "meter", "pack"];
  if (!validUnits.includes(unit.toLowerCase())) {
    warnings.push(`Unit "${unit}" is non-standard (valid: ${validUnits.join(", ")})`);
  }

  const status: "valid" | "warning" | "error" =
    errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "valid";

  return { rowIndex, data: obj, errors, warnings, status };
}

// ── POST: Parse & Validate (preview) ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const contentType = req.headers.get("content-type") || "";

    // Check if this is a multipart form with a file, or JSON with csvData
    let csvText: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      // Validate file type
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        return NextResponse.json({ error: "File must be a .csv file" }, { status: 400 });
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
      }

      csvText = await file.text();
    } else {
      // JSON body with csvData for preview step
      const body = await req.json();

      // If it has an "action" field, it's an execution request
      if (body.action === "execute" && Array.isArray(body.rows)) {
        return executeImport(businessId, body.rows, body);
      }

      // Otherwise it's raw CSV text
      csvText = body.csvData;
      if (!csvText) {
        return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });
      }
    }

    if (!csvText) {
      return NextResponse.json({ error: "No CSV data" }, { status: 400 });
    }

    // Parse CSV
    const lines = parseCSV(csvText);
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    const headers = lines[0].map((h) => h.trim());
    const dataLines = lines.slice(1).filter((l) => l.some((cell) => cell.trim()));

    if (dataLines.length === 0) {
      return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
    }

    // Load existing categories for validation
    const cats = await db.mSCategory.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true },
    });
    const categoryMap: CategoryMap = {};
    for (const cat of cats) {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    }

    // Track SKUs within file for duplicate detection
    const fileSKUs = new Set<string>();

    // Validate each row
    const rows: CSVRow[] = dataLines.map((line, idx) =>
      validateRow(line, headers, idx + 2, categoryMap, fileSKUs)
    );

    const validCount = rows.filter((r) => r.status === "valid" || r.status === "warning").length;
    const warningCount = rows.filter((r) => r.status === "warning").length;
    const errorCount = rows.filter((r) => r.status === "error").length;

    const result: ImportResult = {
      rows,
      totalRows: rows.length,
      validCount,
      warningCount,
      errorCount,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process CSV" },
      { status: 500 }
    );
  }
}

// ── Execute Import ──

async function executeImport(
  businessId: string,
  rows: Array<{ data: Record<string, string>; status: string }>,
  body: Record<string, unknown>
) {
  const validRows = rows.filter(
    (r) => r.status === "valid" || r.status === "warning"
  );

  if (validRows.length === 0) {
    return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
  }

  // Collect categories that need to be created
  const categoryNames = new Set<string>();
  for (const row of validRows) {
    const cat = (row.data["category"] || "").trim();
    if (cat) categoryNames.add(cat);
  }

  // Create missing categories
  const existingCats = await db.mSCategory.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true },
  });
  const catMap: Record<string, string> = {};
  for (const c of existingCats) {
    catMap[c.name.toLowerCase()] = c.id;
  }

  for (const catName of categoryNames) {
    if (!catMap[catName.toLowerCase()]) {
      const slug = catName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      const created = await db.mSCategory.create({
        data: {
          businessId,
          name: catName,
          slug,
          isActive: true,
          sortOrder: 0,
        },
      });
      catMap[catName.toLowerCase()] = created.id;
    }
  }

  // Batch insert products (chunks of 100)
  const BATCH_SIZE = 100;
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);

    try {
      await db.mSProduct.createMany({
        data: batch.map((row) => {
          const catName = (row.data["category"] || "").trim();
          return {
            businessId,
            name: (row.data["name"] || "").trim(),
            brand: (row.data["brand"] || "").trim(),
            sku: (row.data["sku"] || "").trim() || null,
            description: (row.data["description"] || "").trim() || null,
            costPrice: parseFloat(row.data["costprice"]) || 0,
            sellPrice: parseFloat(row.data["sellingprice"]) || 0,
            stock: parseInt(row.data["stock"]) || 0,
            minStock: parseInt(row.data["lowstockalert"]) || 0,
            warrantyMonths: parseInt(row.data["warrantymonths"]) || 0,
            unit: (row.data["unit"] || "piece").trim().toLowerCase(),
            serialTracked: false,
            categoryId: catName ? catMap[catName.toLowerCase()] || null : null,
            isActive: true,
          };
        }),
        skipDuplicates: false,
      });
      imported += batch.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Batch insert failed";
      errors.push(`Rows ${i + 1}-${i + batch.length}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped: rows.length - imported,
    errors: errors.length > 0 ? errors : undefined,
    message: `${imported} product(s) imported successfully${errors.length > 0 ? `, ${errors.length} error(s)` : ""}`,
  });
}