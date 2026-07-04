// GET /api/businesses/[id]/stock-count-day/[scdId]/export?format=pdf|excel
// P4: Export count sheet + variance report as PDF (print-friendly HTML) or Excel (.xlsx)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatScdStatus } from "@/lib/scd";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scdId: string }> }
) {
  const { id: businessId, scdId } = await params;
  const format = req.nextUrl.searchParams.get("format") || "pdf";

  try {
    // Fetch SCD with full detail: zoneSessions + lines + summaries
    const scd = await db.stockCountDay.findFirst({
      where: { id: scdId, businessId },
      include: {
        zoneSessions: {
          orderBy: { sortOrder: "asc" },
          include: {
            zone: { select: { id: true, name: true, color: true } },
            lines: {
              orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
              include: {
                product: {
                  select: { id: true, name: true, genericName: true, unit: true, rackNo: true },
                },
              },
            },
          },
        },
        summaries: {
          include: {
            product: {
              select: { id: true, name: true, genericName: true, unit: true, rackNo: true },
            },
          },
          orderBy: { variance: "desc" },
        },
      },
    });

    if (!scd) {
      return NextResponse.json({ error: "Stock Count Day not found" }, { status: 404 });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { name: true, address: true, phone: true, shopCode: true },
    });

    const dateStr = new Date(scd.createdAt).toISOString().split("T")[0];
    const safeName = scd.name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);

    if (format === "excel") {
      return await generateExcel(scd, business, safeName, dateStr);
    }
    // Default: PDF (print-friendly HTML)
    return generatePdfHtml(scd, business, safeName, dateStr);
  } catch (error) {
    console.error("SCD export error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}

// ── PDF: print-friendly HTML (browser prints to PDF) ──────────────────────
function generatePdfHtml(
  scd: any,
  business: any,
  safeName: string,
  dateStr: string
): NextResponse {
  const mismatches = scd.summaries.filter(
    (s: any) => s.variance !== null && Math.abs(s.variance) > 0.001
  );
  const uncounted = scd.summaries.filter((s: any) => s.totalCountedQty === null);
  const matched = scd.summaries.filter(
    (s: any) => s.totalCountedQty !== null && (s.variance === null || Math.abs(s.variance) <= 0.001)
  );

  const reasonLabels: Record<string, string> = {
    theft: "Theft / suspected theft",
    damage: "Damage / spoilage",
    data_error: "Data entry error",
    expired: "Expired / disposed without record",
    other: "Other",
  };

  const zoneSheets = scd.zoneSessions.map((zs: any) => {
    const rows = zs.lines.map((l: any, i: number) => {
      const expected = l.systemQtyAtStart - l.soldDuringScd;
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(l.product.name)}</td>
          <td>${escapeHtml(l.product.genericName || "")}</td>
          <td>${escapeHtml(l.product.unit || "")}</td>
          <td style="text-align:right">${l.countedQty ?? "—"}</td>
          <td style="text-align:right">${expected}</td>
          <td style="text-align:right">${l.countedQty !== null ? (l.countedQty - expected).toFixed(0) : "—"}</td>
          <td>${l.status}</td>
        </tr>`;
    }).join("");
    return `
      <div class="zone-section">
        <h2>Zone: ${escapeHtml(zs.zone.name)}</h2>
        <p class="meta">Status: ${zs.status} · ${zs.lines.length} products · Closed: ${zs.closedAt ? new Date(zs.closedAt).toLocaleString() : "—"}</p>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Product</th><th>Generic</th><th>Unit</th>
              <th>Counted</th><th>Expected</th><th>Diff</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#999">No products in this zone</td></tr>'}</tbody>
        </table>
      </div>`;
  }).join("");

  const varianceRows = mismatches.map((s: any, i: number) => {
    const expected = s.systemQtyAtStart - s.soldDuringScd;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.product.name)}</td>
        <td style="text-align:right">${expected} ${escapeHtml(s.product.unit || "")}</td>
        <td style="text-align:right">${s.totalCountedQty ?? "—"}</td>
        <td style="text-align:right;color:${(s.variance ?? 0) > 0 ? "green" : "red"};font-weight:bold">
          ${s.variance !== null ? (s.variance > 0 ? "+" : "") + s.variance.toFixed(0) : "—"}
        </td>
        <td>${s.varianceReason ? escapeHtml(reasonLabels[s.varianceReason] || s.varianceReason) : "—"}</td>
        <td>${s.varianceNote ? escapeHtml(s.varianceNote) : "—"}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(scd.name)} — Stock Count Report</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 12px; line-height: 1.4; }
  .header { border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 4px 0; font-size: 20px; color: #064e3b; }
  .header .meta { color: #6b7280; font-size: 11px; }
  .header .shop { font-weight: bold; color: #0d9488; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center; }
  .summary-card .num { font-size: 22px; font-weight: bold; }
  .summary-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .summary-card.matched .num { color: #059669; }
  .summary-card.mismatch .num { color: #d97706; }
  .summary-card.uncounted .num { color: #6b7280; }
  .summary-card.total .num { color: #0d9488; }
  h2 { font-size: 15px; color: #064e3b; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-top: 24px; margin-bottom: 8px; }
  .zone-section { page-break-inside: avoid; margin-bottom: 16px; }
  .meta { font-size: 10px; color: #6b7280; margin: 2px 0 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f0fdf4; color: #064e3b; text-align: left; padding: 6px 8px; border-bottom: 2px solid #0d9488; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #0d9488; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; }
  .print-btn:hover { background: #0f766e; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="header">
    <h1>${escapeHtml(scd.name)}</h1>
    <p class="meta">
      <span class="shop">${escapeHtml(business?.name || "Pharmacy")}</span>
      ${business?.shopCode ? "· Shop code: " + escapeHtml(business.shopCode) : ""}
      · ${new Date(scd.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      · Status: ${formatScdStatus(scd.status)}
    </p>
    ${business?.address ? `<p class="meta">${escapeHtml(business.address)}</p>` : ""}
    ${business?.phone ? `<p class="meta">Phone: ${escapeHtml(business.phone)}</p>` : ""}
  </div>

  <div class="summary-grid">
    <div class="summary-card total"><div class="num">${scd.summaries.length}</div><div class="label">Total Products</div></div>
    <div class="summary-card matched"><div class="num">${matched.length}</div><div class="label">Matched</div></div>
    <div class="summary-card mismatch"><div class="num">${mismatches.length}</div><div class="label">Variances</div></div>
    <div class="summary-card uncounted"><div class="num">${uncounted.length}</div><div class="label">Not Counted</div></div>
  </div>

  <h2>Zone Count Sheets</h2>
  ${zoneSheets || "<p>No zone data available.</p>"}

  ${mismatches.length > 0 ? `
  <h2>Variance Report</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Product</th><th>Expected</th><th>Counted</th><th>Diff</th><th>Reason</th><th>Note</th></tr>
    </thead>
    <tbody>${varianceRows}</tbody>
  </table>` : ""}

  ${uncounted.length > 0 ? `
  <h2>Not Counted (skipped)</h2>
  <p class="meta">${uncounted.length} product(s) were not counted and will be skipped during apply.</p>
  <table>
    <thead><tr><th>Product</th></tr></thead>
    <tbody>
      ${uncounted.map((s: any) => `<tr><td>${escapeHtml(s.product.name)}</td></tr>`).join("")}
    </tbody>
  </table>` : ""}

  <div class="footer">
    Generated by InventoryOS · ${new Date().toLocaleString("en-GB")}
    ${scd.appliedAt ? "· Applied: " + new Date(scd.appliedAt).toLocaleDateString("en-GB") : ""}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${safeName}_${dateStr}.html"`,
    },
  });
}

// ── Excel: .xlsx via exceljs ──────────────────────────────────────────────
async function generateExcel(
  scd: any,
  business: any,
  safeName: string,
  dateStr: string
): Promise<NextResponse> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InventoryOS";
  workbook.created = new Date();

  // ── Sheet 1: Summary ─────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 40 },
  ];
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FF064E3B" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };

  const mismatches = scd.summaries.filter(
    (s: any) => s.variance !== null && Math.abs(s.variance) > 0.001
  );
  const uncounted = scd.summaries.filter((s: any) => s.totalCountedQty === null);
  const matched = scd.summaries.filter(
    (s: any) => s.totalCountedQty !== null && (s.variance === null || Math.abs(s.variance) <= 0.001)
  );

  const summaryRows = [
    { field: "Count Name", value: scd.name },
    { field: "Business", value: business?.name || "" },
    { field: "Shop Code", value: business?.shopCode || "" },
    { field: "Date Created", value: new Date(scd.createdAt).toLocaleString("en-GB") },
    { field: "Status", value: formatScdStatus(scd.status) },
    { field: "Started At", value: scd.startedAt ? new Date(scd.startedAt).toLocaleString("en-GB") : "—" },
    { field: "Closed At", value: scd.closedAt ? new Date(scd.closedAt).toLocaleString("en-GB") : "—" },
    { field: "Applied At", value: scd.appliedAt ? new Date(scd.appliedAt).toLocaleString("en-GB") : "—" },
    { field: "Zones Total", value: scd.zoneSessions.length },
    { field: "Zones Closed", value: scd.zoneSessions.filter((z: any) => z.status === "closed").length },
    { field: "Total Products", value: scd.summaries.length },
    { field: "Matched", value: matched.length },
    { field: "Variances", value: mismatches.length },
    { field: "Not Counted", value: uncounted.length },
  ];
  summaryRows.forEach((r) => summarySheet.addRow(r));

  // ── Sheet 2: Variance Report ─────────────────────────────────────────
  const varianceSheet = workbook.addWorksheet("Variances");
  varianceSheet.columns = [
    { header: "#", key: "num", width: 5 },
    { header: "Product", key: "product", width: 30 },
    { header: "Generic", key: "generic", width: 20 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Expected", key: "expected", width: 10 },
    { header: "Counted", key: "counted", width: 10 },
    { header: "Diff", key: "diff", width: 10 },
    { header: "Reason", key: "reason", width: 25 },
    { header: "Note", key: "note", width: 40 },
  ];
  varianceSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  varianceSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };

  const reasonLabels: Record<string, string> = {
    theft: "Theft / suspected theft",
    damage: "Damage / spoilage",
    data_error: "Data entry error",
    expired: "Expired / disposed without record",
    other: "Other",
  };

  mismatches.forEach((s: any, i: number) => {
    const expected = s.systemQtyAtStart - s.soldDuringScd;
    varianceSheet.addRow({
      num: i + 1,
      product: s.product.name,
      generic: s.product.genericName || "",
      unit: s.product.unit || "",
      expected,
      counted: s.totalCountedQty ?? "",
      diff: s.variance !== null ? Number(s.variance.toFixed(2)) : "",
      reason: s.varianceReason ? (reasonLabels[s.varianceReason] || s.varianceReason) : "",
      note: s.varianceNote || "",
    });
  });

  // ── Sheet 3+: One sheet per zone ─────────────────────────────────────
  scd.zoneSessions.forEach((zs: any) => {
    const safeZoneName = zs.zone.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 28) || "Zone";
    const sheet = workbook.addWorksheet(`Zone: ${safeZoneName}`.slice(0, 31));
    sheet.columns = [
      { header: "#", key: "num", width: 5 },
      { header: "Product", key: "product", width: 30 },
      { header: "Generic", key: "generic", width: 20 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Counted Qty", key: "counted", width: 12 },
      { header: "Expected", key: "expected", width: 10 },
      { header: "Diff", key: "diff", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Auto-Assigned", key: "autoAssigned", width: 13 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };

    zs.lines.forEach((l: any, i: number) => {
      const expected = l.systemQtyAtStart - l.soldDuringScd;
      sheet.addRow({
        num: i + 1,
        product: l.product.name,
        generic: l.product.genericName || "",
        unit: l.product.unit || "",
        counted: l.countedQty ?? "",
        expected,
        diff: l.countedQty !== null ? Number((l.countedQty - expected).toFixed(2)) : "",
        status: l.status,
        autoAssigned: l.autoAssigned ? "Yes" : "No",
      });
    });
  });

  // ── Sheet N+1: Not Counted ───────────────────────────────────────────
  if (uncounted.length > 0) {
    const uncountedSheet = workbook.addWorksheet("Not Counted");
    uncountedSheet.columns = [
      { header: "#", key: "num", width: 5 },
      { header: "Product", key: "product", width: 40 },
      { header: "Generic", key: "generic", width: 25 },
      { header: "Unit", key: "unit", width: 8 },
    ];
    uncountedSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    uncountedSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B7280" } };
    uncounted.forEach((s: any, i: number) => {
      uncountedSheet.addRow({
        num: i + 1,
        product: s.product.name,
        generic: s.product.genericName || "",
        unit: s.product.unit || "",
      });
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}_${dateStr}.xlsx"`,
    },
  });
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
