// GET /api/businesses/[id]/reports/expiry
// Generates a printable expiry report (daily/weekly/monthly)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const period = url.searchParams.get("period") || "daily"; // daily, weekly, monthly
    const format = url.searchParams.get("format") || "json"; // json or csv

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, address: true, phone: true, businessType: { select: { name: true } } },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Fetch preferences
    let prefs = await db.alertPreference.findUnique({ where: { businessId } });
    if (!prefs) {
      prefs = await db.alertPreference.create({ data: { businessId } });
    }

    const now = new Date();
    const periodStart = new Date();
    if (period === "weekly") {
      periodStart.setDate(periodStart.getDate() - 7);
    } else if (period === "monthly") {
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else {
      periodStart.setHours(0, 0, 0, 0); // daily — start of today
    }

    // Fetch all batches with stock
    const batches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        status: { not: "destroyed" },
      },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            dosageForm: true, manufacturer: true, unit: true, mrp: true,
            scheduleType: true, isPrescription: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    // Categorize batches by severity using preferences
    const sections = {
      expired: [],
      critical: [], // <= critical days
      warning: [], // <= warning days
      notice: [], // <= notice days
      safe: [], // > notice days
      quarantined: [],
    };

    let totalValueAtRisk = 0;
    let totalUnits = 0;
    let totalUnitsAtRisk = 0;

    for (const batch of batches) {
      const daysUntilExpiry = Math.floor(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const value = (batch.mrp || 0) * batch.quantity;
      totalUnits += batch.quantity;

      const batchData = {
        batchNo: batch.batchNo,
        productName: batch.product.name,
        genericName: batch.product.genericName,
        strength: batch.product.strength,
        dosageForm: batch.product.dosageForm,
        manufacturer: batch.product.manufacturer,
        category: batch.product.category?.name,
        expiryDate: batch.expiryDate.toISOString().split("T")[0],
        daysUntilExpiry,
        quantity: batch.quantity,
        unit: batch.product.unit,
        mrp: batch.mrp,
        value,
        scheduleType: batch.product.scheduleType,
        isPrescription: batch.product.isPrescription,
      };

      if (batch.status === "quarantined") {
        sections.quarantined.push(batchData);
      } else if (daysUntilExpiry < 0) {
        sections.expired.push(batchData);
        totalValueAtRisk += value;
        totalUnitsAtRisk += batch.quantity;
      } else if (daysUntilExpiry <= prefs.expiryCriticalDays) {
        sections.critical.push(batchData);
        totalValueAtRisk += value;
        totalUnitsAtRisk += batch.quantity;
      } else if (daysUntilExpiry <= prefs.expiryWarningDays) {
        sections.warning.push(batchData);
        totalValueAtRisk += value;
        totalUnitsAtRisk += batch.quantity;
      } else if (daysUntilExpiry <= prefs.expiryNoticeDays) {
        sections.notice.push(batchData);
        totalValueAtRisk += value;
        totalUnitsAtRisk += batch.quantity;
      } else {
        sections.safe.push(batchData);
      }
    }

    const report = {
      generatedAt: now.toISOString(),
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      business: {
        name: business.name,
        address: business.address,
        phone: business.phone,
        type: business.businessType.name,
      },
      preferences: {
        expiryCriticalDays: prefs.expiryCriticalDays,
        expiryWarningDays: prefs.expiryWarningDays,
        expiryNoticeDays: prefs.expiryNoticeDays,
      },
      summary: {
        totalBatches: batches.length,
        totalUnits,
        totalUnitsAtRisk,
        totalValueAtRisk,
        sections: {
          expired: sections.expired.length,
          critical: sections.critical.length,
          warning: sections.warning.length,
          notice: sections.notice.length,
          safe: sections.safe.length,
          quarantined: sections.quarantined.length,
        },
      },
      sections,
    };

    // CSV format
    if (format === "csv") {
      const csvLines = [
        `InventoryOS Expiry Report — ${business.name}`,
        `Generated: ${now.toLocaleString()}`,
        `Period: ${period}`,
        ``,
        `Section,Product,Batch No,Expiry Date,Days Left,Quantity,Unit,MRP,Value,Manufacturer,Category`,
      ];

      for (const [sectionName, sectionBatches] of Object.entries(sections)) {
        for (const b of sectionBatches) {
          csvLines.push(`${sectionName},"${b.productName}",${b.batchNo},${b.expiryDate},${b.daysUntilExpiry},${b.quantity},${b.unit},${b.mrp || ""},${b.value.toFixed(2)},"${b.manufacturer || ""}","${b.category || ""}"`);
        }
      }

      csvLines.push(``);
      csvLines.push(`Summary: ${batches.length} batches, ${totalUnits} units, ${totalUnitsAtRisk} at risk, ৳${totalValueAtRisk.toFixed(2)} value at risk`);

      return new NextResponse(csvLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="expiry_report_${period}_${now.toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Expiry report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
