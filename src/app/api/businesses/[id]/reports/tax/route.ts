// GET /api/businesses/[id]/reports/tax
// Bangladesh VAT compliance report: output tax (sales), input tax (purchases), net payable
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const period = url.searchParams.get("period") || "month"; // today, week, month, quarter, year
    const format = url.searchParams.get("format") || "json";

    const now = new Date();
    let startDate = new Date();
    let periodLabel = "";
    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        periodLabel = "Today";
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        periodLabel = "Last 7 days";
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        periodLabel = "Last 30 days";
        break;
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3);
        periodLabel = "Last quarter";
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        periodLabel = "Last year";
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
        periodLabel = "Last 30 days";
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, address: true, phone: true },
    });

    // ── OUTPUT TAX (VAT collected on sales) ──
    const sales = await db.sale.findMany({
      where: {
        businessId,
        status: "completed",
        createdAt: { gte: startDate },
      },
      select: {
        id: true, invoiceNo: true, subtotal: true, taxAmount: true,
        totalAmount: true, createdAt: true,
        customer: { select: { name: true } },
        items: {
          select: {
            id: true, productName: true, quantity: true, unitPrice: true,
            totalPrice: true, productId: true, batchId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch product VAT rates for per-item breakdown
    const productIds = [...new Set(sales.flatMap((s) => s.items.map((i) => i.productId)))];
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, vatRate: true, hsnCode: true, scheduleType: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalOutputTax = 0;
    let totalTaxableSales = 0;
    let totalExemptSales = 0;

    const salesWithTax = sales.map((sale) => {
      const itemsWithTax = sale.items.map((item) => {
        const product = productMap.get(item.productId);
        const vatRate = product?.vatRate || 0;
        const taxableAmount = item.totalPrice;
        const vatAmount = (taxableAmount * vatRate) / 100;

        if (vatRate > 0) totalTaxableSales += taxableAmount;
        else totalExemptSales += taxableAmount;
        totalOutputTax += vatAmount;

        return {
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxableAmount: taxableAmount.toFixed(2),
          vatRate: vatRate,
          vatAmount: vatAmount.toFixed(2),
          hsnCode: product?.hsnCode || null,
          scheduleType: product?.scheduleType || null,
        };
      });

      return {
        invoiceNo: sale.invoiceNo,
        customerName: sale.customer?.name || "Walk-in",
        date: sale.createdAt,
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        totalAmount: sale.totalAmount,
        items: itemsWithTax,
      };
    });

    // ── INPUT TAX (VAT paid on purchases) ──
    const purchases = await db.purchase.findMany({
      where: {
        businessId,
        status: { not: "cancelled" },
        createdAt: { gte: startDate },
      },
      select: {
        id: true, purchaseNo: true, subtotal: true, taxAmount: true,
        totalAmount: true, createdAt: true, invoiceNo: true,
        supplier: { select: { name: true } },
        items: {
          select: { id: true, productName: true, quantity: true, unitCost: true, totalPrice: true, productId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalInputTax = 0;
    let totalTaxablePurchases = 0;

    const purchasesWithTax = purchases.map((purchase) => {
      const itemsWithTax = purchase.items.map((item) => {
        const product = productMap.get(item.productId);
        const vatRate = product?.vatRate || 0;
        const taxableAmount = item.totalPrice;
        const vatAmount = (taxableAmount * vatRate) / 100;

        if (vatRate > 0) totalTaxablePurchases += taxableAmount;
        totalInputTax += vatAmount;

        return {
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          taxableAmount: taxableAmount.toFixed(2),
          vatRate: vatRate,
          vatAmount: vatAmount.toFixed(2),
          hsnCode: product?.hsnCode || null,
        };
      });

      return {
        purchaseNo: purchase.purchaseNo,
        supplierInvoiceNo: purchase.invoiceNo,
        supplierName: purchase.supplier?.name || "Unknown",
        date: purchase.createdAt,
        subtotal: purchase.subtotal,
        taxAmount: purchase.taxAmount,
        totalAmount: purchase.totalAmount,
        items: itemsWithTax,
      };
    });

    // ── NET VAT PAYABLE ──
    const netVatPayable = totalOutputTax - totalInputTax;

    // ── VAT BY RATE (summary) ──
    const vatByRateMap = new Map<number, { taxableAmount: number; vatAmount: number; count: number }>();
    salesWithTax.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.vatRate > 0) {
          const existing = vatByRateMap.get(item.vatRate) || { taxableAmount: 0, vatAmount: 0, count: 0 };
          existing.taxableAmount += parseFloat(item.taxableAmount);
          existing.vatAmount += parseFloat(item.vatAmount);
          existing.count++;
          vatByRateMap.set(item.vatRate, existing);
        }
      });
    });
    const vatByRate = Array.from(vatByRateMap.entries()).map(([rate, data]) => ({
      rate,
      taxableAmount: data.taxableAmount,
      vatAmount: data.vatAmount,
      itemCount: data.count,
    })).sort((a, b) => b.rate - a.rate);

    const report = {
      generatedAt: now.toISOString(),
      period,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      business: business ? { name: business.name, address: business.address, phone: business.phone } : null,
      summary: {
        // Output (Sales)
        totalSales: sales.reduce((s, sale) => s + sale.totalAmount, 0),
        taxableSales: totalTaxableSales,
        exemptSales: totalExemptSales,
        outputTax: totalOutputTax,
        salesCount: sales.length,
        // Input (Purchases)
        totalPurchases: purchases.reduce((s, p) => s + p.totalAmount, 0),
        taxablePurchases: totalTaxablePurchases,
        inputTax: totalInputTax,
        purchaseCount: purchases.length,
        // Net
        netVatPayable,
        isRefund: netVatPayable < 0,
      },
      vatByRate,
      outputTaxDetails: salesWithTax,
      inputTaxDetails: purchasesWithTax,
    };

    // CSV format
    if (format === "csv") {
      const lines = [
        `InventoryOS VAT/Tax Report — ${business?.name || ""}`,
        `Period: ${periodLabel} (${startDate.toLocaleDateString()} to ${now.toLocaleDateString()})`,
        `Generated: ${now.toLocaleString()}`,
        ``,
        `=== SUMMARY ===`,
        `Description,Amount (BDT)`,
        `Total Sales (incl. VAT),${report.summary.totalSales.toFixed(2)}`,
        `Taxable Sales,${report.summary.taxableSales.toFixed(2)}`,
        `Exempt/Zero-rated Sales,${report.summary.exemptSales.toFixed(2)}`,
        `Output VAT (collected),${report.summary.outputTax.toFixed(2)}`,
        `Total Purchases (incl. VAT),${report.summary.totalPurchases.toFixed(2)}`,
        `Taxable Purchases,${report.summary.taxablePurchases.toFixed(2)}`,
        `Input VAT (paid),${report.summary.inputTax.toFixed(2)}`,
        `Net VAT Payable,${report.summary.netVatPayable.toFixed(2)}`,
        ``,
        `=== VAT BY RATE ===`,
        `Rate (%),Taxable Amount,VAT Amount,Item Count`,
        ...vatByRate.map((v) => `${v.rate}%,${v.taxableAmount.toFixed(2)},${v.vatAmount.toFixed(2)},${v.itemCount}`),
        ``,
        `=== OUTPUT TAX DETAILS (Sales) ===`,
        `Invoice,Customer,Date,Subtotal,Tax,Total`,
        ...salesWithTax.map((s) => `${s.invoiceNo},"${s.customerName}",${new Date(s.date).toLocaleDateString()},${s.subtotal.toFixed(2)},${s.taxAmount.toFixed(2)},${s.totalAmount.toFixed(2)}`),
        ``,
        `=== INPUT TAX DETAILS (Purchases) ===`,
        `PO No,Supplier,Date,Subtotal,Tax,Total`,
        ...purchasesWithTax.map((p) => `${p.purchaseNo},"${p.supplierName}",${new Date(p.date).toLocaleDateString()},${p.subtotal.toFixed(2)},${p.taxAmount.toFixed(2)},${p.totalAmount.toFixed(2)}`),
      ];

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="vat_report_${period}_${now.toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Tax report error:", error);
    return NextResponse.json({ error: "Failed to generate tax report" }, { status: 500 });
  }
}
