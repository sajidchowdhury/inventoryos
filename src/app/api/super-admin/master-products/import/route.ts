// POST /api/super-admin/master-products/import
// Bulk CSV import. Accepts { csv: "name,genericName,..." } or { products: [...] }
// Returns { imported, updated, skipped, errors }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const products: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 1) continue;
    const row: any = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j].trim();
    }
    if (row.name && row.name.length > 1) products.push(row);
  }
  return products;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    let products: any[] = [];

    if (body.csv) {
      products = parseCSV(body.csv);
    } else if (body.products && Array.isArray(body.products)) {
      products = body.products;
    } else {
      return NextResponse.json({ error: "Send { csv: '...' } or { products: [...] }" }, { status: 400 });
    }

    if (products.length === 0) {
      return NextResponse.json({ error: "No products found in input" }, { status: 400 });
    }

    // Build manufacturer map (find or create all unique manufacturers)
    const manufacturerNames = [...new Set(products.map(p => p.manufacturer).filter(Boolean))] as string[];
    const manufacturerMap = new Map<string, string>();

    for (const mfrName of manufacturerNames) {
      const mfr = await db.masterManufacturer.upsert({
        where: { name: mfrName },
        update: {},
        create: { name: mfrName },
      });
      manufacturerMap.set(mfrName, mfr.id);
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      for (const p of batch) {
        try {
          const name = p.name?.trim();
          if (!name || name.length < 2) { skipped++; continue; }

          const manufacturerStr = p.manufacturer?.trim() || null;
          const manufacturerId = manufacturerStr ? manufacturerMap.get(manufacturerStr) || null : null;

          const data = {
            name,
            genericName: p.genericname?.trim() || p.genericName?.trim() || null,
            strength: p.strength?.trim() || null,
            dosageForm: p.dosageform?.trim() || p.dosageForm?.trim() || null,
            manufacturerId,
            manufacturerStr,
            categoryName: p.categoryname?.trim() || p.categoryName?.trim() || null,
            defaultMrp: parseFloat(p.defaultmrp || p.defaultMrp || "0") || null,
            unit: p.unit?.trim() || "piece",
            stripSize: parseInt(p.stripsize || p.stripSize || "0") || null,
            boxSize: parseInt(p.boxsize || p.boxSize || "0") || null,
            barcode: p.barcode?.trim() || null,
          };

          // Check if product exists by name + manufacturerStr
          const existing = await db.masterProduct.findFirst({
            where: { name: data.name, manufacturerStr: data.manufacturerStr },
          });

          if (existing) {
            await db.masterProduct.update({ where: { id: existing.id }, data });
            updated++;
          } else {
            await db.masterProduct.create({ data });
            imported++;
          }
        } catch (err) {
          errors.push(`Row ${i + products.indexOf(p) + 2}: ${err instanceof Error ? err.message : "Unknown"}`);
          skipped++;
        }
      }
    }

    // Update all manufacturer product counts
    for (const [mfrName, mfrId] of manufacturerMap) {
      const count = await db.masterProduct.count({ where: { manufacturerId: mfrId } });
      await db.masterManufacturer.update({ where: { id: mfrId }, data: { productCount: count } });
    }

    return NextResponse.json({
      success: true,
      message: `Import complete: ${imported} new, ${updated} updated, ${skipped} skipped`,
      imported,
      updated,
      skipped,
      errors: errors.slice(0, 20), // First 20 errors
      totalErrors: errors.length,
    });
  } catch (error) {
    console.error("[master-products/import] failed:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
