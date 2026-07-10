// POST /api/businesses/[id]/products/import
// Bulk import products from CSV data
// Accepts JSON body: { products: [...] } OR raw CSV text
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ImportProduct {
  name: string;
  genericName?: string;
  sku?: string;
  barcode?: string;
  productType?: string;
  unit?: string;
  stripSize?: number;
  boxSize?: number;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  scheduleType?: string;
  hsnCode?: string;
  vatRate?: number;
  mrp?: number;
  isPrescription?: boolean;
  storageCondition?: string;
  rackNo?: string;
  minStock?: number;
  maxStock?: number;
  reorderLevel?: number;
  categoryName?: string; // Will be matched to existing category
  categoryId?: string;
}

interface ImportRow {
  row: number;
  data: ImportProduct;
  status: "pending" | "success" | "error";
  message?: string;
  productId?: string;
}

// Parse a CSV line, handling quoted values with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
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

// Parse CSV text into array of objects
function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = lines.slice(1).map((line) => parseCSVLine(line));

  return { headers, rows };
}

// Map CSV row to product data using flexible header matching
function mapRowToProduct(headers: string[], row: string[]): ImportProduct {
  const product: ImportProduct = { name: "" };

  headers.forEach((header, idx) => {
    const value = row[idx] || "";
    const numValue = parseFloat(value);
    const boolValue = value.toLowerCase() === "yes" || value.toLowerCase() === "true" || value === "1";

    switch (header) {
      case "name":
      case "productname":
      case "product":
      case "brandname":
      case "brand":
        product.name = value;
        break;
      case "genericname":
      case "generic":
      case "molecule":
        product.genericName = value;
        break;
      case "sku":
      case "code":
      case "itemcode":
        product.sku = value;
        break;
      case "barcode":
        product.barcode = value;
        break;
      case "type":
      case "producttype":
        product.productType = value;
        break;
      case "unit":
        product.unit = value;
        break;
      case "stripsize":
      case "strip":
        product.stripSize = isNaN(numValue) ? undefined : numValue;
        break;
      case "boxsize":
      case "box":
        product.boxSize = isNaN(numValue) ? undefined : numValue;
        break;
      case "strength":
        product.strength = value;
        break;
      case "dosageform":
      case "form":
      case "dosage":
        product.dosageForm = value;
        break;
      case "manufacturer":
      case "brandmanufacturer":
      case "company":
        product.manufacturer = value;
        break;
      case "scheduletype":
      case "schedule":
        product.scheduleType = value;
        break;
      case "hsncode":
      case "hsn":
        product.hsnCode = value;
        break;
      case "vatrate":
      case "vat":
        product.vatRate = isNaN(numValue) ? undefined : numValue;
        break;
      case "mrp":
      case "price":
      case "sellingprice":
        product.mrp = isNaN(numValue) ? undefined : numValue;
        break;
      case "prescription":
      case "rx":
      case "isprescription":
        product.isPrescription = boolValue;
        break;
      case "storage":
      case "storagecondition":
        product.storageCondition = value;
        break;
      case "rack":
      case "rackno":
      case "shelf":
        product.rackNo = value;
        break;
      case "minstock":
      case "min":
        product.minStock = isNaN(numValue) ? undefined : numValue;
        break;
      case "maxstock":
      case "max":
        product.maxStock = isNaN(numValue) ? undefined : numValue;
        break;
      case "reorderlevel":
      case "reorder":
        product.reorderLevel = isNaN(numValue) ? undefined : numValue;
        break;
      case "category":
      case "categoryname":
        product.categoryName = value;
        break;
    }
  });

  return product;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const contentType = req.headers.get("content-type") || "";

    let products: ImportProduct[] = [];
    let isCSV = false;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (Array.isArray(body.products)) {
        products = body.products;
      } else if (typeof body.csv === "string") {
        isCSV = true;
        const { headers, rows } = parseCSV(body.csv);
        products = rows.map((row) => mapRowToProduct(headers, row));
      } else {
        return NextResponse.json({ error: "Expected 'products' array or 'csv' string" }, { status: 400 });
      }
    } else {
      // Treat as raw CSV text
      isCSV = true;
      const csvText = await req.text();
      const { headers, rows } = parseCSV(csvText);
      products = rows.map((row) => mapRowToProduct(headers, row));
    }

    if (products.length === 0) {
      return NextResponse.json({ error: "No products to import" }, { status: 400 });
    }

    // Fetch all categories for this business (for name-based matching)
    const businessCategories = await db.category.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, slug: true },
    });

    const categoryMap = new Map<string, string>();
    businessCategories.forEach((c) => {
      categoryMap.set(c.name.toLowerCase(), c.id);
      categoryMap.set(c.slug.toLowerCase(), c.id);
    });

    // Process each product
    const results: ImportRow[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const rowNum = i + (isCSV ? 2 : 1); // +2 for CSV (header row), +1 for JSON (1-indexed)

      // Validate
      if (!p.name || !p.name.trim()) {
        results.push({
          row: rowNum,
          data: p,
          status: "error",
          message: "Missing required field: name",
        });
        errorCount++;
        continue;
      }

      try {
        // Resolve category by name if no ID provided
        let categoryId = p.categoryId;
        if (!categoryId && p.categoryName) {
          categoryId = categoryMap.get(p.categoryName.toLowerCase()) || undefined;
        }

        const product = await db.product.create({
          data: {
            businessId,
            categoryId: categoryId || null,
            name: p.name.trim(),
            genericName: p.genericName?.trim() || null,
            sku: p.sku?.trim() || null,
            barcode: p.barcode?.trim() || null,
            productType: p.productType || "medicine",
            unit: p.unit || "piece",
            stripSize: p.stripSize || null,
            boxSize: p.boxSize || null,
            strength: p.strength?.trim() || null,
            dosageForm: p.dosageForm || null,
            manufacturer: p.manufacturer?.trim() || null,
            scheduleType: p.scheduleType || null,
            hsnCode: p.hsnCode?.trim() || null,
            vatRate: p.vatRate || 0,
            mrp: p.mrp || null,
            isPrescription: p.isPrescription || false,
            storageCondition: p.storageCondition || null,
            rackNo: p.rackNo?.trim() || null,
            minStock: p.minStock || 0,
            maxStock: p.maxStock || 0,
            reorderLevel: p.reorderLevel || 0,
          },
        });

        // Create inventory record
        await db.inventory.create({
          data: {
            businessId,
            productId: product.id,
            quantity: 0,
            minStock: p.minStock || 0,
            unitCost: null,
          },
        });

        results.push({
          row: rowNum,
          data: p,
          status: "success",
          message: `Created: ${product.name}`,
          productId: product.id,
        });
        successCount++;
      } catch (err) {
        console.error(`Import error at row ${rowNum}:`, err);
        results.push({
          row: rowNum,
          data: p,
          status: "error",
          message: err instanceof Error ? err.message : "Database error",
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: products.length,
        success: successCount,
        errors: errorCount,
      },
      results,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Failed to import products" }, { status: 500 });
  }
}
