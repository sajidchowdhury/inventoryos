// GET /api/businesses/[id]/products/template
// Returns a CSV template with sample rows for product import
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params; // businessId not needed for template

  const headers = [
    "name",
    "genericName",
    "strength",
    "dosageForm",
    "manufacturer",
    "scheduleType",
    "mrp",
    "categoryName",
    "unit",
    "stripSize",
    "boxSize",
    "barcode",
    "sku",
    "isPrescription",
    "storageCondition",
    "rackNo",
    "minStock",
    "maxStock",
    "reorderLevel",
    "vatRate",
    "hsnCode",
  ];

  const sampleRows = [
    [
      "Napa Extra",
      "Paracetamol + Caffeine",
      "500mg",
      "Tablet",
      "Square",
      "OTC",
      "50",
      "Pain & Fever",
      "tablet",
      "10",
      "10",
      "8940001234567",
      "SQ-NAP-EXT",
      "No",
      "Room Temp",
      "A3",
      "50",
      "500",
      "100",
      "0",
      "30049099",
    ],
    [
      "Amodis",
      "Metronidazole",
      "400mg",
      "Tablet",
      "Square",
      "Schedule_H",
      "30",
      "Antibiotics",
      "tablet",
      "10",
      "10",
      "",
      "SQ-AMO",
      "Yes",
      "Room Temp",
      "A1",
      "100",
      "1000",
      "200",
      "0",
      "30049099",
    ],
    [
      "Seclo",
      "Omeprazole",
      "20mg",
      "Capsule",
      "Beximco",
      "Schedule_H",
      "60",
      "Digestive Health",
      "capsule",
      "14",
      "10",
      "",
      "BX-SEC",
      "Yes",
      "Cool & Dry",
      "B2",
      "50",
      "500",
      "100",
      "0",
      "30049099",
    ],
  ];

  // Escape CSV fields (wrap in quotes if contains comma)
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [
    headers.join(","),
    ...sampleRows.map((row) => row.map(escape).join(",")),
  ];

  // Add a comment row explaining each field (as comment lines after data)
  csvLines.push("");
  csvLines.push("# Field Guide:");
  csvLines.push("# name* - Product brand name (required)");
  csvLines.push("# genericName - Generic/active ingredient name");
  csvLines.push("# strength - e.g., 500mg, 250mg/5ml");
  csvLines.push("# dosageForm - Tablet, Capsule, Syrup, Injection, Cream, Drops");
  csvLines.push("# manufacturer - Brand manufacturer name");
  csvLines.push("# scheduleType - OTC, Schedule_H, Schedule_H1, Schedule_X, Narcotic");
  csvLines.push("# mrp - Maximum Retail Price in Taka");
  csvLines.push("# categoryName - Must match existing category name in your pharmacy");
  csvLines.push("# unit - piece, tablet, capsule, strip, box, bottle, tube, sachet, ml, g");
  csvLines.push("# stripSize - Tablets per strip (e.g., 10)");
  csvLines.push("# boxSize - Strips per box (e.g., 10)");
  csvLines.push("# barcode - Product barcode (optional)");
  csvLines.push("# sku - Internal SKU code");
  csvLines.push("# isPrescription - Yes/No");
  csvLines.push("# storageCondition - Room Temp, Fridge (2-8C), Cool & Dry, Freezer, Protect from Light");
  csvLines.push("# rackNo - Shelf location (e.g., A3, Rack-5)");
  csvLines.push("# minStock - Low stock alert threshold");
  csvLines.push("# maxStock - Overstock warning threshold");
  csvLines.push("# reorderLevel - Quantity at which to reorder");
  csvLines.push("# vatRate - VAT percentage (0-100)");
  csvLines.push("# hsnCode - HSN/HS code for VAT");

  const csv = csvLines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="InventoryOS_product_template.csv"`,
    },
  });
}
