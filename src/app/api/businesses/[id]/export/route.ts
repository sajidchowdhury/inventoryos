// GET /api/businesses/[id]/export
// Full data export/backup as JSON or CSV
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const format = url.searchParams.get("format") || "json";
    const modules = url.searchParams.get("modules")?.split(",") || [
      "products", "categories", "batches", "sales", "customers",
      "suppliers", "purchases", "payments", "returns", "transactions",
    ];

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, address: true, phone: true, createdAt: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const exportData: Record<string, unknown> = {
      _meta: {
        exportedAt: new Date().toISOString(),
        business: business,
        version: "1.0",
        modules: modules,
      },
    };

    // Fetch each module in parallel
    const fetchPromises: Promise<void>[] = [];

    if (modules.includes("products")) {
      fetchPromises.push(
        db.product.findMany({ where: { businessId } }).then((data) => { exportData.products = data; })
      );
    }
    if (modules.includes("categories")) {
      fetchPromises.push(
        db.category.findMany({ where: { businessId } }).then((data) => { exportData.categories = data; })
      );
    }
    if (modules.includes("batches")) {
      fetchPromises.push(
        db.batch.findMany({ where: { businessId } }).then((data) => { exportData.batches = data; })
      );
    }
    if (modules.includes("inventory")) {
      fetchPromises.push(
        db.inventory.findMany({ where: { businessId } }).then((data) => { exportData.inventory = data; })
      );
    }
    if (modules.includes("sales")) {
      fetchPromises.push(
        db.sale.findMany({
          where: { businessId },
          include: { items: true, customer: { select: { name: true, phone: true } } },
        }).then((data) => { exportData.sales = data; })
      );
    }
    if (modules.includes("customers")) {
      fetchPromises.push(
        db.customer.findMany({ where: { businessId } }).then((data) => { exportData.customers = data; })
      );
    }
    if (modules.includes("suppliers")) {
      fetchPromises.push(
        db.supplier.findMany({ where: { businessId } }).then((data) => { exportData.suppliers = data; })
      );
    }
    if (modules.includes("purchases")) {
      fetchPromises.push(
        db.purchase.findMany({
          where: { businessId },
          include: { items: true, supplier: { select: { name: true } } },
        }).then((data) => { exportData.purchases = data; })
      );
    }
    if (modules.includes("payments")) {
      fetchPromises.push(
        db.payment.findMany({ where: { businessId } }).then((data) => { exportData.payments = data; })
      );
    }
    if (modules.includes("returns")) {
      fetchPromises.push(
        db.return.findMany({
          where: { businessId },
          include: { items: true },
        }).then((data) => { exportData.returns = data; })
      );
    }
    if (modules.includes("transactions")) {
      fetchPromises.push(
        db.transaction.findMany({ where: { businessId } }).then((data) => { exportData.transactions = data; })
      );
    }
    if (modules.includes("discountRules")) {
      fetchPromises.push(
        db.discountRule.findMany({ where: { businessId } }).then((data) => { exportData.discountRules = data; })
      );
    }

    await Promise.all(fetchPromises);

    // Add record counts
    exportData._meta.recordCounts = {};
    for (const key of Object.keys(exportData)) {
      if (key !== "_meta" && Array.isArray(exportData[key])) {
        exportData._meta.recordCounts[key] = (exportData[key] as unknown[]).length;
      }
    }

    const totalRecords = Object.values(exportData._meta.recordCounts).reduce((sum: number, count) => sum + (count as number), 0);
    exportData._meta.totalRecords = totalRecords;

    // JSON format
    if (format === "json") {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="inventoryos_backup_${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // CSV format (summary only — full CSV would be too complex for multi-table)
    if (format === "csv") {
      const lines = [
        `InventoryOS Data Export Summary`,
        `Business: ${business.name}`,
        `Exported: ${new Date().toLocaleString()}`,
        `Total Records: ${totalRecords}`,
        ``,
        `Module,Record Count`,
        ...Object.entries(exportData._meta.recordCounts).map(([key, count]) => `${key},${count}`),
      ];

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="inventoryos_summary_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: exportData });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
