// POST /api/businesses/[id]/cctv/products/import
// Action 'parse': parse CSV text, validate rows, return preview
// Action 'import': import validated rows into database
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  // Warning for missing optional fields
  if (!data.category) warnings.push("No category specified");

  let status: "valid" | "warning" | "error" = "valid";
  if (errors.length > 0) status = "error";
  else if (warnings.length > 0) status = "warning";

  return { rowIndex, data, errors, warnings, status };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
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

    for (const row of importable) {
      try {
        await db.cCTVProduct.create({
          data: {
            businessId,
            categoryId: row.data.category ? categoryMap[row.data.category] : null,
            name: row.data.name,
            brand: row.data.brand,
            model: row.data.model || null,
            sku: row.data.sku || null,
            costPrice: parseFloat(row.data.costPrice) || 0,
            sellPrice: parseFloat(row.data.sellingPrice) || 0,
            stock: parseInt(row.data.stock) || 0,
            minStock: parseInt(row.data.lowStockAlert) || 0,
            warrantyMonths: parseInt(row.data.warrantyMonths) || 0,
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
    });
  }

  return NextResponse.json({ error: "Unknown action. Use 'parse' or 'import'." }, { status: 400 });
}
