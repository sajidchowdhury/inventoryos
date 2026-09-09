// GET /api/businesses/[id]/cctv/monthly-upload/template
// Downloads an Excel (.xlsx) template with 5 sheets pre-filled with the
// business's current data. The user fills in the empty columns and uploads
// it back to auto-create sales, purchases, expenses, and payments.
//
// Sheets:
// 1. "Products" — all products with stock + prices + empty sold/purchased qty
// 2. "Expenses" — expense categories + empty amount/method/description
// 3. "Financial Summary" — opening balance, estimated vs actual, retained earnings
// 4. "Customers" — customer list with current balance + empty payment received
// 5. "Suppliers" — supplier list with current balance + empty payment made

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // Fetch all the data we need to pre-fill the template
  const [products, customers, suppliers, expenses] = await Promise.all([
    db.cCTVProduct.findMany({
      where: { businessId, isActive: true },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.cCTVCustomer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    }),
    db.cCTVSupplier.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    }),
    db.cCTVExpense.findMany({
      where: { businessId },
      select: { category: true, amount: true },
      orderBy: { expenseDate: "desc" },
      take: 100,
    }),
  ]);

  // Compute customer/supplier balances (simplified — uses openingBalance + sales)
  const customerSales = await db.cCTVSale.groupBy({
    by: ["customerId"],
    where: { businessId },
    _sum: { totalAmount: true, paidAmount: true },
  });
  const customerBalanceMap = new Map<string, number>();
  for (const c of customers) {
    const sales = customerSales.find((s) => s.customerId === c.id);
    const balance = Number(c.openingBalance) + Number(sales?._sum.totalAmount || 0) - Number(sales?._sum.paidAmount || 0);
    customerBalanceMap.set(c.id, balance);
  }

  const supplierPurchases = await db.cCTVPurchase.groupBy({
    by: ["supplierId"],
    where: { businessId },
    _sum: { totalAmount: true, paidAmount: true },
  });
  const supplierBalanceMap = new Map<string, number>();
  for (const s of suppliers) {
    const pur = supplierPurchases.find((p) => p.supplierId === s.id);
    const balance = Number(s.openingBalance) + Number(pur?._sum.totalAmount || 0) - Number(pur?._sum.paidAmount || 0);
    supplierBalanceMap.set(s.id, balance);
  }

  // Get expense categories (unique)
  const expenseCategories = Array.from(new Set(expenses.map((e) => e.category))).sort();

  // Build the Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InventoryOS CCTV Module";
  workbook.created = new Date();

  // ── Sheet 1: Products ──
  const wsProducts = workbook.addWorksheet("Products", {
    properties: { tabColor: "7C3AED" },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsProducts.columns = [
    { header: "Product Name", key: "name", width: 30 },
    { header: "Brand", key: "brand", width: 15 },
    { header: "Category", key: "category", width: 15 },
    { header: "Current Stock", key: "stock", width: 12 },
    { header: "Cost Price (৳)", key: "costPrice", width: 12 },
    { header: "Sell Price (৳)", key: "sellPrice", width: 12 },
    { header: "Serial Tracked", key: "serialTracked", width: 12 },
    { header: "Monthly Sold Qty", key: "soldQty", width: 15 },
    { header: "Monthly Purchased Qty", key: "purchasedQty", width: 15 },
    { header: "Purchase Cost (৳)", key: "purchaseCost", width: 15 },
    { header: "Notes", key: "notes", width: 25 },
  ];
  // Style header row
  wsProducts.getRow(1).font = { bold: true, color: "FFFFFF" };
  wsProducts.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "7C3AED" } };
  // Pre-fill products
  for (const p of products) {
    wsProducts.addRow({
      name: p.name,
      brand: p.brand,
      category: p.category?.name || "",
      stock: p.stock,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      serialTracked: p.serialTracked ? "Yes" : "No",
      soldQty: "", // empty — user fills in
      purchasedQty: "",
      purchaseCost: "",
      notes: "",
    });
  }
  // Highlight empty columns
  for (let row = 2; row <= products.length + 1; row++) {
    for (const col of [8, 9, 10, 11]) {
      const cell = wsProducts.getRow(row).getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8E1" } };
    }
  }

  // ── Sheet 2: Expenses ──
  const wsExpenses = workbook.addWorksheet("Expenses", {
    properties: { tabColor: "F43F5E" },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsExpenses.columns = [
    { header: "Category", key: "category", width: 20 },
    { header: "Amount (৳)", key: "amount", width: 15 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
    { header: "Paid To", key: "paidTo", width: 20 },
    { header: "Description", key: "description", width: 30 },
  ];
  wsExpenses.getRow(1).font = { bold: true, color: "FFFFFF" };
  wsExpenses.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F43F5E" } };
  // Pre-fill known categories
  for (const cat of expenseCategories.length > 0 ? expenseCategories : ["rent", "electricity", "transport", "salary", "tea", "phone", "other"]) {
    wsExpenses.addRow({
      category: cat,
      amount: "",
      paymentMethod: "cash",
      paidTo: "",
      description: "",
    });
  }
  // Add 5 empty rows for custom categories
  for (let i = 0; i < 5; i++) {
    wsExpenses.addRow({ category: "", amount: "", paymentMethod: "cash", paidTo: "", description: "" });
  }
  // Highlight empty columns
  for (let row = 2; row <= expenseCategories.length + 6; row++) {
    for (const col of [2, 3, 4, 5]) {
      const cell = wsExpenses.getRow(row).getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8E1" } };
    }
  }

  // ── Sheet 3: Financial Summary ──
  const wsFinancial = workbook.addWorksheet("Financial Summary", {
    properties: { tabColor: "10B981" },
  });
  wsFinancial.columns = [
    { header: "Field", key: "field", width: 30 },
    { header: "Value (৳)", key: "value", width: 20 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  wsFinancial.getRow(1).font = { bold: true, color: "FFFFFF" };
  wsFinancial.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "10B981" } };

  // Pre-fill known values
  const totalStockValue = products.reduce((s, p) => s + p.stock * Number(p.costPrice), 0);
  const totalSellValue = products.reduce((s, p) => s + p.stock * Number(p.sellPrice), 0);

  wsFinancial.addRow({ field: "Month (YYYY-MM)", value: "", notes: "e.g. 2026-09" });
  wsFinancial.addRow({ field: "Opening Balance (cash on hand)", value: "", notes: "Cash at start of month" });
  wsFinancial.addRow({ field: "Previous Investment Balance", value: totalStockValue.toFixed(2), notes: "Current stock value (cost) — auto-filled" });
  wsFinancial.addRow({ field: "New Investment (purchases)", value: "", notes: "Total purchases this month (auto-calculated from Products sheet)" });
  wsFinancial.addRow({ field: "Estimated Revenue", value: "", notes: "Expected sales for the month" });
  wsFinancial.addRow({ field: "Actual Revenue (sales)", value: "", notes: "Auto-calculated from Products sheet sold qty × sell price" });
  wsFinancial.addRow({ field: "Actual COGS", value: "", notes: "Auto-calculated from Products sheet sold qty × cost price" });
  wsFinancial.addRow({ field: "Gross Profit", value: "", notes: "Actual Revenue − COGS (auto-calculated)" });
  wsFinancial.addRow({ field: "Total Expenses", value: "", notes: "Auto-calculated from Expenses sheet" });
  wsFinancial.addRow({ field: "Net Profit", value: "", notes: "Gross Profit − Total Expenses (auto-calculated)" });
  wsFinancial.addRow({ field: "Retained Earnings", value: "", notes: "Net Profit retained in business (not withdrawn)" });
  wsFinancial.addRow({ field: "Closing Balance", value: "", notes: "Opening + Revenue − Expenses − Purchases (auto-calculated)" });
  wsFinancial.addRow({ field: "", value: "", notes: "" });
  wsFinancial.addRow({ field: "Investor / Owner Name", value: "", notes: "Name of the shop owner / investor" });
  wsFinancial.addRow({ field: "Investor Share %", value: "", notes: "e.g. 100 for sole owner, 50 for 50-50 partnership" });
  wsFinancial.addRow({ field: "Investor Withdrawal (৳)", value: "", notes: "Capital withdrawn by owner this month" });

  // Highlight empty value cells
  for (let row = 2; row <= 16; row++) {
    const cell = wsFinancial.getRow(row).getCell(2);
    if (!cell.value) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8E1" } };
    }
  }

  // ── Sheet 4: Customers ──
  const wsCustomers = workbook.addWorksheet("Customers", {
    properties: { tabColor: "3B82F6" },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsCustomers.columns = [
    { header: "Customer Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Previous Balance (৳)", key: "prevBalance", width: 18 },
    { header: "Payment Received (৳)", key: "paymentReceived", width: 18 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
  ];
  wsCustomers.getRow(1).font = { bold: true, color: "FFFFFF" };
  wsCustomers.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "3B82F6" } };
  for (const c of customers) {
    wsCustomers.addRow({
      name: c.name,
      phone: c.phone || "",
      prevBalance: customerBalanceMap.get(c.id) || 0,
      paymentReceived: "",
      paymentMethod: "cash",
    });
  }
  // Highlight empty columns
  for (let row = 2; row <= customers.length + 1; row++) {
    for (const col of [4, 5]) {
      const cell = wsCustomers.getRow(row).getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8E1" } };
    }
  }

  // ── Sheet 5: Suppliers ──
  const wsSuppliers = workbook.addWorksheet("Suppliers", {
    properties: { tabColor: "F59E0B" },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsSuppliers.columns = [
    { header: "Supplier Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Previous Balance (৳)", key: "prevBalance", width: 18 },
    { header: "Payment Made (৳)", key: "paymentMade", width: 18 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
  ];
  wsSuppliers.getRow(1).font = { bold: true, color: "FFFFFF" };
  wsSuppliers.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F59E0B" } };
  for (const s of suppliers) {
    wsSuppliers.addRow({
      name: s.name,
      phone: s.phone || "",
      prevBalance: supplierBalanceMap.get(s.id) || 0,
      paymentMade: "",
      paymentMethod: "cash",
    });
  }
  // Highlight empty columns
  for (let row = 2; row <= suppliers.length + 1; row++) {
    for (const col of [4, 5]) {
      const cell = wsSuppliers.getRow(row).getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8E1" } };
    }
  }

  // ── Sheet 6: Instructions ──
  const wsInstructions = workbook.addWorksheet("Instructions", {
    properties: { tabColor: "6B7280" },
  });
  wsInstructions.columns = [{ width: 80 }];
  const instructions = [
    "CCTV Monthly Data Upload — Instructions",
    "",
    "1. Download this Excel file. It contains 5 data sheets + this instruction sheet.",
    "",
    "2. Fill in the YELLOW-HIGHLIGHTED cells only. Pre-filled data (white cells) is for reference.",
    "",
    "3. Products sheet:",
    "   - Fill 'Monthly Sold Qty' for each product sold this month",
    "   - Fill 'Monthly Purchased Qty' + 'Purchase Cost' for each product purchased this month",
    "   - The system will auto-create sales and purchases from this data",
    "",
    "4. Expenses sheet:",
    "   - Fill 'Amount', 'Payment Method', 'Paid To', 'Description' for each expense",
    "   - Add custom categories in the empty rows at the bottom",
    "",
    "5. Financial Summary sheet:",
    "   - Fill 'Month', 'Opening Balance', 'Estimated Revenue', 'Retained Earnings'",
    "   - Other fields (Revenue, COGS, Gross Profit, Expenses, Net Profit, Closing Balance) are AUTO-CALCULATED",
    "   - Fill 'Investor Name', 'Investor Share %', 'Investor Withdrawal' for owner tracking",
    "",
    "6. Customers sheet:",
    "   - 'Previous Balance' is pre-filled from the system",
    "   - Fill 'Payment Received' + 'Payment Method' for customer payments this month",
    "",
    "7. Suppliers sheet:",
    "   - 'Previous Balance' is pre-filled from the system",
    "   - Fill 'Payment Made' + 'Payment Method' for supplier payments this month",
    "",
    "8. Save the file and upload it via the Monthly Upload page.",
    "   The system will auto-calculate and create all records.",
    "",
    "⚠  Only one month per upload. Use the 'Month' field in Financial Summary to specify which month.",
    "⚠  Do NOT change the column headers or sheet names — the parser uses them.",
    "⚠  For serial-tracked products, the system will create placeholder serials if you enter a purchased qty.",
  ];
  for (let i = 0; i < instructions.length; i++) {
    const row = wsInstructions.addRow([instructions[i]]);
    if (i === 0) row.font = { bold: true, size: 14, color: "7C3AED" };
  }

  // Generate the Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const month = new Date().toISOString().split("T")[0].slice(0, 7);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cctv-monthly-upload-template-${month}.xlsx"`,
    },
  });
}

// ── POST: Upload + auto-calculate ──
// Accepts the filled Excel file, parses it, creates sales/purchases/
// expenses/payments, auto-calculates monthly P&L, and returns a summary.

import { requireActiveSubscription } from "@/lib/subscription-guard";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // ── Parse Products sheet ──
    const wsProducts = workbook.getWorksheet("Products");
    const productResults: { name: string; soldQty: number; purchasedQty: number; purchaseCost: number; status: string }[] = [];
    let totalSalesRevenue = 0;
    let totalCOGS = 0;
    let totalPurchases = 0;

    if (wsProducts) {
      wsProducts.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const name = String(row.getCell(1).value || "").trim();
        if (!name) return;
        const soldQty = parseInt(String(row.getCell(8).value || "0")) || 0;
        const purchasedQty = parseInt(String(row.getCell(9).value || "0")) || 0;
        const purchaseCost = parseFloat(String(row.getCell(10).value || "0")) || 0;
        if (soldQty > 0 || purchasedQty > 0) {
          productResults.push({ name, soldQty, purchasedQty, purchaseCost, status: "pending" });
        }
      });
    }

    // ── Parse Expenses sheet ──
    const wsExpenses = workbook.getWorksheet("Expenses");
    const expenseResults: { category: string; amount: number; paymentMethod: string; paidTo: string; description: string }[] = [];
    let totalExpenses = 0;

    if (wsExpenses) {
      wsExpenses.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const category = String(row.getCell(1).value || "").trim();
        const amount = parseFloat(String(row.getCell(2).value || "0")) || 0;
        const paymentMethod = String(row.getCell(3).value || "cash").trim();
        const paidTo = String(row.getCell(4).value || "").trim();
        const description = String(row.getCell(5).value || "").trim();
        if (category && amount > 0) {
          expenseResults.push({ category, amount, paymentMethod, paidTo, description });
          totalExpenses += amount;
        }
      });
    }

    // ── Parse Financial Summary sheet ──
    const wsFinancial = workbook.getWorksheet("Financial Summary");
    let monthStr = "";
    let openingBalance = 0;
    let estimatedRevenue = 0;
    let retainedEarnings = 0;
    let investorName = "";
    let investorShare = 100;
    let investorWithdrawal = 0;

    if (wsFinancial) {
      const getFieldValue = (rowNum: number): string => {
        const cell = wsFinancial.getRow(rowNum).getCell(2).value;
        return cell ? String(cell).trim() : "";
      };
      monthStr = getFieldValue(2);
      openingBalance = parseFloat(getFieldValue(3)) || 0;
      estimatedRevenue = parseFloat(getFieldValue(6)) || 0;
      retainedEarnings = parseFloat(getFieldValue(12)) || 0;
      investorName = getFieldValue(14);
      investorShare = parseFloat(getFieldValue(15)) || 100;
      investorWithdrawal = parseFloat(getFieldValue(16)) || 0;
    }

    // If month not specified, use current month
    if (!monthStr) monthStr = new Date().toISOString().slice(0, 7);
    const monthDate = new Date(monthStr + "-01");
    const endOfMonth = new Date(monthDate);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // ── Parse Customers sheet ──
    const wsCustomers = workbook.getWorksheet("Customers");
    const customerPayments: { name: string; amount: number; paymentMethod: string }[] = [];

    if (wsCustomers) {
      wsCustomers.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(1).value || "").trim();
        const amount = parseFloat(String(row.getCell(4).value || "0")) || 0;
        const paymentMethod = String(row.getCell(5).value || "cash").trim();
        if (name && amount > 0) {
          customerPayments.push({ name, amount, paymentMethod });
        }
      });
    }

    // ── Parse Suppliers sheet ──
    const wsSuppliers = workbook.getWorksheet("Suppliers");
    const supplierPayments: { name: string; amount: number; paymentMethod: string }[] = [];

    if (wsSuppliers) {
      wsSuppliers.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(1).value || "").trim();
        const amount = parseFloat(String(row.getCell(4).value || "0")) || 0;
        const paymentMethod = String(row.getCell(5).value || "cash").trim();
        if (name && amount > 0) {
          supplierPayments.push({ name, amount, paymentMethod });
        }
      });
    }

    // ── Process: create records in a transaction ──
    const summary = await db.$transaction(async (tx) => {
      let salesCreated = 0;
      let purchasesCreated = 0;
      let expensesCreated = 0;
      let customerPaymentsCreated = 0;
      let supplierPaymentsCreated = 0;

      // 1. Create sales from product line items
      for (const item of productResults) {
        if (item.soldQty > 0) {
          const product = await tx.cCTVProduct.findFirst({
            where: { businessId, name: { equals: item.name, mode: "insensitive" }, isActive: true },
          });
          if (!product) continue;

          const sellPrice = Number(product.sellPrice);
          const costPrice = Number(product.costPrice);
          const subtotal = sellPrice * item.soldQty;
          const totalAmount = subtotal;
          const paidAmount = totalAmount;

          const sale = await tx.cCTVSale.create({
            data: {
              businessId,
              customerName: "Monthly Upload",
              subtotal,
              discount: 0,
              totalAmount,
              paidAmount,
              dueAmount: 0,
              paymentType: "cash",
              saleDate: endOfMonth,
              notes: `Monthly upload for ${monthStr}`,
            },
          });

          // Create sale item
          await tx.cCTVSaleItem.create({
            data: {
              saleId: sale.id,
              businessId,
              productId: product.id,
              productName: product.name,
              quantity: item.soldQty,
              sellPrice,
              costPrice,
              discount: 0,
            },
          });

          // Decrement stock
          await tx.cCTVProduct.update({
            where: { id: product.id },
            data: { stock: { decrement: item.soldQty } },
          });

          // Create stock movement
          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId: product.id,
              productName: product.name,
              movementType: "SALE",
              quantityChange: -item.soldQty,
              balanceAfter: product.stock - item.soldQty,
              referenceId: sale.id,
              referenceType: "sale",
              notes: `Monthly upload sale: ${item.soldQty} × ${product.name}`,
            },
          });

          totalSalesRevenue += totalAmount;
          totalCOGS += costPrice * item.soldQty;
          salesCreated++;
        }
      }

      // 2. Create purchases from product line items
      for (const item of productResults) {
        if (item.purchasedQty > 0) {
          const product = await tx.cCTVProduct.findFirst({
            where: { businessId, name: { equals: item.name, mode: "insensitive" }, isActive: true },
          });
          if (!product) continue;

          const unitCost = item.purchaseCost > 0 ? item.purchaseCost / item.purchasedQty : Number(product.costPrice);
          const totalAmount = item.purchaseCost > 0 ? item.purchaseCost : unitCost * item.purchasedQty;

          const purchase = await tx.cCTVPurchase.create({
            data: {
              businessId,
              supplierName: "Monthly Upload",
              totalAmount,
              paidAmount: totalAmount,
              dueAmount: 0,
              purchaseDate: endOfMonth,
              notes: `Monthly upload purchase for ${monthStr}`,
            },
          });

          await tx.cCTVPurchaseItem.create({
            data: {
              purchaseId: purchase.id,
              businessId,
              productId: product.id,
              productName: product.name,
              quantity: item.purchasedQty,
              costPrice: unitCost,
            },
          });

          // Increment stock
          await tx.cCTVProduct.update({
            where: { id: product.id },
            data: { stock: { increment: item.purchasedQty } },
          });

          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId: product.id,
              productName: product.name,
              movementType: "PURCHASE",
              quantityChange: item.purchasedQty,
              balanceAfter: product.stock + item.purchasedQty,
              referenceId: purchase.id,
              referenceType: "purchase",
              notes: `Monthly upload purchase: ${item.purchasedQty} × ${product.name}`,
            },
          });

          totalPurchases += totalAmount;
          purchasesCreated++;
        }
      }

      // 3. Create expenses
      for (const exp of expenseResults) {
        const createdExpense = await tx.cCTVExpense.create({
          data: {
            businessId,
            category: exp.category,
            description: exp.description || null,
            amount: exp.amount,
            paymentMethod: exp.paymentMethod,
            paidTo: exp.paidTo || null,
            expenseDate: endOfMonth,
          },
        });

        // Create ledger entries
        const paymentAccount = paymentMethodToAccount(exp.paymentMethod);
        await createLedgerEntries(tx, [
          { businessId, accountId: LEDGER_ACCOUNTS.EXPENSE, entryType: "DEBIT", amount: exp.amount, referenceId: createdExpense.id, referenceType: "expense", description: `Monthly upload expense: ${exp.category}` },
          { businessId, accountId: paymentAccount, entryType: "CREDIT", amount: exp.amount, referenceId: createdExpense.id, referenceType: "expense", description: `Paid via ${exp.paymentMethod}` },
        ]);

        expensesCreated++;
      }

      // 4. Create customer payments
      for (const cp of customerPayments) {
        const customer = await tx.cCTVCustomer.findFirst({
          where: { businessId, name: { equals: cp.name, mode: "insensitive" } },
        });
        await tx.cCTVPayment.create({
          data: {
            businessId,
            type: "customer_payment",
            customerId: customer?.id || null,
            amount: cp.amount,
            paymentMethod: cp.paymentMethod,
            paymentDate: endOfMonth,
            notes: `Monthly upload payment from ${cp.name}`,
          },
        });
        customerPaymentsCreated++;
      }

      // 5. Create supplier payments
      for (const sp of supplierPayments) {
        const supplier = await tx.cCTVSupplier.findFirst({
          where: { businessId, name: { equals: sp.name, mode: "insensitive" } },
        });
        await tx.cCTVPayment.create({
          data: {
            businessId,
            type: "supplier_payment",
            supplierId: supplier?.id || null,
            amount: sp.amount,
            paymentMethod: sp.paymentMethod,
            paymentDate: endOfMonth,
            notes: `Monthly upload payment to ${sp.name}`,
          },
        });
        supplierPaymentsCreated++;
      }

      // 6. Auto-calculate monthly P&L
      const grossProfit = totalSalesRevenue - totalCOGS;
      const netProfit = grossProfit - totalExpenses;
      const closingBalance = openingBalance + totalSalesRevenue + totalPurchases - totalExpenses - totalPurchases;

      return {
        month: monthStr,
        records: {
          salesCreated,
          purchasesCreated,
          expensesCreated,
          customerPaymentsCreated,
          supplierPaymentsCreated,
        },
        calculations: {
          openingBalance,
          totalSalesRevenue,
          totalCOGS,
          grossProfit,
          totalPurchases,
          totalExpenses,
          netProfit,
          estimatedRevenue,
          retainedEarnings,
          closingBalance: openingBalance + totalSalesRevenue - totalExpenses,
          investorName,
          investorShare,
          investorWithdrawal,
        },
      };
    });

    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    console.error("[monthly-upload] POST failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to process upload" }, { status: 500 });
  }
}
