// ── InventoryOS: SQL Query Router (Gap 6 — Fast deterministic AI shortcuts) ──
//
// The SQL router intercepts natural-language business questions and answers
// them directly with a Prisma query + a pre-formatted markdown response,
// WITHOUT calling the LLM. This saves tokens, latency, and money for the
// 20 most common questions operators ask.
//
// If routeQuery() returns { handled: true }, the AI chat handler should
// just stream back the response verbatim and skip the LLM call entirely.
// If it returns { handled: false }, the message goes to the LLM as usual.
//
// All currency values are formatted as BDT: ৳1234.56

import { db } from "./db";

// ── Types ──
export interface RouteResult {
  handled: boolean;
  pattern?: string;
  response?: string;
  queryMs?: number;
}

export interface PatternDescriptor {
  name: string;
  description: string;
  keywords: string[];
  matchMode: "all" | "any";
  excludeKeywords?: string[];
}

interface Pattern extends PatternDescriptor {
  handler: (businessId: string, message: string) => Promise<string>;
}

// ── Helpers ──

/** Lowercase, strip punctuation, collapse whitespace. */
function normalizeMessage(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Format a number as BDT currency: ৳1234.56 */
function bdt(amount: number): string {
  return `৳${amount.toFixed(2)}`;
}

/** Format a number with thousands separators. */
function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

/** Returns midnight UTC today (start of day in UTC). */
function startOfTodayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Returns midnight UTC for the first day of the current month. */
function startOfMonthUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Format a Date for display (YYYY-MM-DD). */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Match a normalized message against a pattern.
 * - excludeKeywords checked first: if ANY present → no match
 * - matchMode "all": every keyword must be present in the message
 * - matchMode "any": at least one keyword must be present
 */
function matchesPattern(
  normalizedMessage: string,
  pattern: { keywords: string[]; matchMode: "all" | "any"; excludeKeywords?: string[] }
): boolean {
  // Check exclusions first
  if (pattern.excludeKeywords && pattern.excludeKeywords.length > 0) {
    for (const ex of pattern.excludeKeywords) {
      const exN = normalizeMessage(ex);
      if (exN && normalizedMessage.includes(exN)) return false;
    }
  }

  // Normalize keywords too so apostrophes/punctuation in keywords match the
  // already-punctuation-stripped message.
  const keywords = pattern.keywords.map((k) => normalizeMessage(k)).filter(Boolean);

  if (pattern.matchMode === "all") {
    return keywords.every((k) => normalizedMessage.includes(k));
  }
  return keywords.some((k) => normalizedMessage.includes(k));
}

// ── 20 Patterns ──
const PATTERNS: Pattern[] = [
  // 1. low-stock
  {
    name: "low-stock",
    description: "Products with inventory.quantity <= 10 (low stock threshold).",
    keywords: ["low stock", "low", "running low", "reorder", "restock", "stock low"],
    matchMode: "any",
    excludeKeywords: ["out of stock", "out-of-stock"],
    handler: async (businessId) => {
      const products = await db.product.findMany({
        where: {
          businessId,
          isActive: true,
          inventory: { quantity: { lte: 10, gt: 0 } },
        },
        select: { id: true, name: true, genericName: true, sku: true },
        take: 50,
        orderBy: { name: "asc" },
      });
      if (products.length === 0) {
        return "✅ **Low Stock Check**\n\nNo products are currently below the low-stock threshold (qty ≤ 10). Everything looks healthy.";
      }
      const lines = products
        .map((p, i) => `${i + 1}. **${p.name}**${p.genericName ? ` (${p.genericName})` : ""}${p.sku ? ` — SKU: ${p.sku}` : ""}`)
        .join("\n");
      return `⚠️ **Low Stock Alert**\n\nFound **${products.length}** product(s) at or below the low-stock threshold (qty ≤ 10):\n\n${lines}\n\n💡 Consider reordering these items soon.`;
    },
  },

  // 2. out-of-stock
  {
    name: "out-of-stock",
    description: "Products with inventory.quantity <= 0 (out of stock).",
    keywords: ["out of stock", "out-of-stock", "stockout", "out of", "unavailable", "no stock"],
    matchMode: "any",
    handler: async (businessId) => {
      const products = await db.product.findMany({
        where: {
          businessId,
          isActive: true,
          inventory: { quantity: { lte: 0 } },
        },
        select: { id: true, name: true, genericName: true, sku: true },
        take: 50,
        orderBy: { name: "asc" },
      });
      if (products.length === 0) {
        return "✅ **Out-of-Stock Check**\n\nNo products are currently out of stock. 🎉";
      }
      const lines = products
        .map((p, i) => `${i + 1}. **${p.name}**${p.genericName ? ` (${p.genericName})` : ""}${p.sku ? ` — SKU: ${p.sku}` : ""}`)
        .join("\n");
      return `🚫 **Out-of-Stock Alert**\n\nFound **${products.length}** product(s) with zero or negative stock:\n\n${lines}\n\n⚠️ These items cannot be sold until restocked.`;
    },
  },

  // 3. product-count
  {
    name: "product-count",
    description: "Total / active / low / out-of-stock product counts.",
    keywords: ["how many products", "product count", "number of products", "total products", "products do i have"],
    matchMode: "any",
    handler: async (businessId) => {
      const [total, active, lowStock, outOfStock] = await Promise.all([
        db.product.count({ where: { businessId } }),
        db.product.count({ where: { businessId, isActive: true } }),
        db.product.count({
          where: { businessId, isActive: true, inventory: { quantity: { lte: 10, gt: 0 } } },
        }),
        db.product.count({
          where: { businessId, isActive: true, inventory: { quantity: { lte: 0 } } },
        }),
      ]);
      return `📦 **Product Inventory Summary**\n\n| Metric | Count |\n|---|---|\n| Total products | ${fmtNum(total)} |\n| Active products | ${fmtNum(active)} |\n| Low stock (≤10) | ${fmtNum(lowStock)} |\n| Out of stock (≤0) | ${fmtNum(outOfStock)} |\n\n${outOfStock > 0 ? "⚠️ You have out-of-stock items — consider reordering." : "✅ No out-of-stock items."}`;
    },
  },

  // 4. today-sales
  {
    name: "today-sales",
    description: "Today's revenue, transaction count, items sold, discounts, average sale.",
    keywords: ["today sales", "todays sales", "sales today", "today revenue", "today s sales"],
    matchMode: "any",
    handler: async (businessId) => {
      const start = startOfTodayUTC();
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      const agg = await db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true, discountAmount: true, totalQuantity: true },
        _count: true,
      });
      const count = agg._count;
      const revenue = agg._sum.totalAmount || 0;
      const discounts = agg._sum.discountAmount || 0;
      const items = agg._sum.totalQuantity || 0;
      const avg = count > 0 ? revenue / count : 0;
      return `💰 **Today's Sales** (UTC ${fmtDate(start)})\n\n| Metric | Value |\n|---|---|\n| Revenue | ${bdt(revenue)} |\n| Transactions | ${fmtNum(count)} |\n| Items sold | ${fmtNum(items)} |\n| Discounts given | ${bdt(discounts)} |\n| Avg sale | ${bdt(avg)} |\n\n${count > 0 ? "📊 Solid day so far." : "💤 No completed sales yet today."}`;
    },
  },

  // 5. top-selling
  {
    name: "top-selling",
    description: "Top 5 products by quantity sold (last 30 days).",
    keywords: ["top selling", "best selling", "top products", "best sellers", "top 5", "popular products"],
    matchMode: "any",
    handler: async (businessId) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // Group sale items by productName — note orderBy must use _count.<field>
      const grouped = await db.saleItem.groupBy({
        by: ["productName"],
        where: { businessId, sale: { status: "completed", createdAt: { gte: since } } },
        _sum: { quantity: true, totalPrice: true },
        _count: true,
        orderBy: { _count: { productName: "desc" } },
        take: 5,
      });
      if (grouped.length === 0) {
        return "📊 **Top Selling Products (last 30 days)**\n\nNo sales recorded in the last 30 days.";
      }
      const lines = grouped
        .map(
          (g, i) =>
            `${i + 1}. **${g.productName}** — ${fmtNum(g._sum.quantity || 0)} units sold across ${fmtNum(g._count)} sale(s) • Revenue: ${bdt(g._sum.totalPrice || 0)}`
        )
        .join("\n");
      return `🏆 **Top 5 Selling Products** (last 30 days)\n\n${lines}`;
    },
  },

  // 6. expiring-soon
  {
    name: "expiring-soon",
    description: "Batches expiring within 90 days (excluding already-expired status).",
    keywords: ["expiring soon", "expiry soon", "near expiry", "near expiry", "expire", "expiring", "expiry"],
    matchMode: "any",
    excludeKeywords: ["expired", "already expired"],
    handler: async (businessId) => {
      const now = new Date();
      const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const batches = await db.batch.findMany({
        where: {
          businessId,
          quantity: { gt: 0 },
          status: { notIn: ["expired", "destroyed"] },
          expiryDate: { gte: now, lte: cutoff },
        },
        select: {
          id: true,
          batchNo: true,
          expiryDate: true,
          quantity: true,
          product: { select: { name: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 50,
      });
      if (batches.length === 0) {
        return "✅ **Expiring Soon**\n\nNo batches expiring in the next 90 days. 🎉";
      }
      const lines = batches
        .map((b, i) => {
          const days = Math.ceil((b.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          const urgency = days <= 7 ? "🔴" : days <= 30 ? "🟠" : "🟡";
          return `${i + 1}. ${urgency} **${b.product.name}** (batch ${b.batchNo}) — expires ${fmtDate(b.expiryDate)} (${days}d) • qty: ${fmtNum(b.quantity)}`;
        })
        .join("\n");
      return `⏰ **Expiring Within 90 Days**\n\nFound **${batches.length}** batch(es) expiring soon:\n\n${lines}\n\n💡 Prioritize selling these (FEFO) or contact suppliers about returns.`;
    },
  },

  // 7. expired
  {
    name: "expired",
    description: "Batches with status='expired' and quantity > 0 (still in inventory).",
    keywords: ["expired", "already expired", "expired batches", "expired stock"],
    matchMode: "any",
    handler: async (businessId) => {
      const batches = await db.batch.findMany({
        where: {
          businessId,
          quantity: { gt: 0 },
          status: "expired",
        },
        select: {
          id: true,
          batchNo: true,
          expiryDate: true,
          quantity: true,
          product: { select: { name: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 50,
      });
      if (batches.length === 0) {
        return "✅ **Expired Stock Check**\n\nNo expired batches with remaining stock. 🎉";
      }
      const totalQty = batches.reduce((s, b) => s + b.quantity, 0);
      const lines = batches
        .map(
          (b, i) =>
            `${i + 1}. 🔴 **${b.product.name}** (batch ${b.batchNo}) — expired ${fmtDate(b.expiryDate)} • qty: ${fmtNum(b.quantity)}`
        )
        .join("\n");
      return `🚨 **Expired Stock in Inventory**\n\nFound **${batches.length}** expired batch(es) still holding stock (total qty: ${fmtNum(totalQty)}):\n\n${lines}\n\n⚠️ These should be disposed or quarantined immediately per regulation.`;
    },
  },

  // 8. customers-owe
  {
    name: "customers-owe",
    description: "Outstanding receivables — sales with paymentStatus in [partial, unpaid].",
    keywords: ["customers owe", "customer owes", "receivables", "outstanding", "who owes", "money owed", "credit", "dues"],
    matchMode: "any",
    handler: async (businessId) => {
      const sales = await db.sale.findMany({
        where: {
          businessId,
          paymentStatus: { in: ["partial", "unpaid"] },
          status: "completed",
        },
        select: {
          id: true,
          invoiceNo: true,
          totalAmount: true,
          paidAmount: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      if (sales.length === 0) {
        return "✅ **Outstanding Receivables**\n\nNo customers currently owe you money. All receivables cleared! 🎉";
      }
      const total = sales.reduce((s, x) => s + (x.totalAmount - x.paidAmount), 0);
      const lines = sales
        .map((s, i) => {
          const due = s.totalAmount - s.paidAmount;
          const cust = s.customer ? s.customer.name : "Walk-in";
          return `${i + 1}. **${cust}**${s.customer?.phone ? ` (${s.customer.phone})` : ""} — invoice ${s.invoiceNo} • due: ${bdt(due)} • dated ${fmtDate(s.createdAt)}`;
        })
        .join("\n");
      return `💵 **Outstanding Receivables**\n\nTotal outstanding: **${bdt(total)}** across **${sales.length}** invoice(s):\n\n${lines}\n\n💡 Follow up with these customers to collect payments.`;
    },
  },

  // 9. owe-suppliers
  {
    name: "owe-suppliers",
    description: "Outstanding payables — suppliers with balance > 0 (we owe them).",
    keywords: ["owe suppliers", "owe supplier", "payables", "suppliers owe", "supplier balance", "owe them", "we owe"],
    matchMode: "any",
    handler: async (businessId) => {
      const suppliers = await db.supplier.findMany({
        where: { businessId, balance: { gt: 0 } },
        select: { id: true, name: true, phone: true, balance: true, totalPurchased: true, totalPaid: true },
        orderBy: { balance: "desc" },
        take: 50,
      });
      if (suppliers.length === 0) {
        return "✅ **Outstanding Payables**\n\nYou don't owe any suppliers money. All payables cleared! 🎉";
      }
      const total = suppliers.reduce((s, x) => s + x.balance, 0);
      const lines = suppliers
        .map(
          (s, i) =>
            `${i + 1}. **${s.name}**${s.phone ? ` (${s.phone})` : ""} — outstanding: ${bdt(s.balance)} • lifetime purchased: ${bdt(s.totalPurchased)} • paid: ${bdt(s.totalPaid)}`
        )
        .join("\n");
      return `💸 **Outstanding Payables (Suppliers)**\n\nTotal payable: **${bdt(total)}** across **${suppliers.length}** supplier(s):\n\n${lines}\n\n💡 Schedule payments to maintain supplier goodwill.`;
    },
  },

  // 10. inventory-value
  {
    name: "inventory-value",
    description: "Cost value + MRP value + potential profit from batches with quantity > 0.",
    keywords: ["inventory value", "valuation", "stock value", "value of inventory", "inventory worth", "worth of stock"],
    matchMode: "any",
    handler: async (businessId) => {
      const batches = await db.batch.findMany({
        where: { businessId, quantity: { gt: 0 }, status: { not: "destroyed" } },
        select: { quantity: true, purchasePrice: true, mrp: true },
      });
      if (batches.length === 0) {
        return "📦 **Inventory Valuation**\n\nNo inventory on hand to value.";
      }
      const costValue = batches.reduce((s, b) => s + (b.purchasePrice || 0) * b.quantity, 0);
      const mrpValue = batches.reduce((s, b) => s + (b.mrp || 0) * b.quantity, 0);
      const potentialProfit = mrpValue - costValue;
      const marginPct = costValue > 0 ? (potentialProfit / costValue) * 100 : 0;
      return `📦 **Inventory Valuation**\n\n| Metric | Value |\n|---|---|\n| Active batches | ${fmtNum(batches.length)} |\n| Cost value | ${bdt(costValue)} |\n| MRP value | ${bdt(mrpValue)} |\n| Potential profit | ${bdt(potentialProfit)} |\n| Margin | ${marginPct.toFixed(1)}% |`;
    },
  },

  // 11. total-customers
  {
    name: "total-customers",
    description: "Customer count. Uses totalSpent > 0 for 'with purchase history' (NOT balance — Customer has no balance field).",
    keywords: ["total customers", "how many customers", "customer count", "number of customers", "customers do i have"],
    matchMode: "any",
    handler: async (businessId) => {
      const [total, active, withHistory] = await Promise.all([
        db.customer.count({ where: { businessId } }),
        db.customer.count({ where: { businessId, isActive: true } }),
        // Customer model does NOT have a 'balance' field — use totalSpent instead.
        db.customer.count({ where: { businessId, totalSpent: { gt: 0 } } }),
      ]);
      return `👥 **Customer Summary**\n\n| Metric | Count |\n|---|---|\n| Total customers | ${fmtNum(total)} |\n| Active customers | ${fmtNum(active)} |\n| With purchase history | ${fmtNum(withHistory)} |`;
    },
  },

  // 12. total-suppliers
  {
    name: "total-suppliers",
    description: "Supplier count. Uses balance > 0 for 'with outstanding balance'.",
    keywords: ["total suppliers", "how many suppliers", "supplier count", "number of suppliers", "suppliers do i have"],
    matchMode: "any",
    handler: async (businessId) => {
      const [total, active, withBalance] = await Promise.all([
        db.supplier.count({ where: { businessId } }),
        db.supplier.count({ where: { businessId, isActive: true } }),
        db.supplier.count({ where: { businessId, balance: { gt: 0 } } }),
      ]);
      return `🏭 **Supplier Summary**\n\n| Metric | Count |\n|---|---|\n| Total suppliers | ${fmtNum(total)} |\n| Active suppliers | ${fmtNum(active)} |\n| With outstanding balance | ${fmtNum(withBalance)} |`;
    },
  },

  // 13. month-sales
  {
    name: "month-sales",
    description: "This month's gross/net sales, returns, and discounts.",
    keywords: ["month sales", "monthly sales", "this month", "sales this month", "months sales", "month revenue"],
    matchMode: "any",
    handler: async (businessId) => {
      const start = startOfMonthUTC();
      const end = new Date();
      const [salesAgg, returnsAgg] = await Promise.all([
        db.sale.aggregate({
          where: { businessId, status: "completed", createdAt: { gte: start, lte: end } },
          _sum: { totalAmount: true, discountAmount: true, subtotal: true },
          _count: true,
        }),
        db.return.aggregate({
          where: { businessId, createdAt: { gte: start, lte: end } },
          _sum: { refundAmount: true },
          _count: true,
        }),
      ]);
      const gross = salesAgg._sum.totalAmount || 0;
      const discounts = salesAgg._sum.discountAmount || 0;
      const returns = returnsAgg._sum.refundAmount || 0;
      const net = gross - returns;
      return `📅 **This Month's Sales** (since ${fmtDate(start)})\n\n| Metric | Value |\n|---|---|\n| Gross sales | ${bdt(gross)} |\n| Discounts given | ${bdt(discounts)} |\n| Returns / refunds | ${bdt(returns)} (${fmtNum(returnsAgg._count)} return(s)) |\n| **Net sales** | **${bdt(net)}** |\n| Transactions | ${fmtNum(salesAgg._count)} |`;
    },
  },

  // 14. week-sales
  {
    name: "week-sales",
    description: "Last 7 days' revenue, transaction count, and daily average.",
    keywords: ["week sales", "weekly sales", "last week", "last 7 days", "this week", "past week", "weeks sales"],
    matchMode: "any",
    handler: async (businessId) => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const agg = await db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
        _count: true,
      });
      const revenue = agg._sum.totalAmount || 0;
      const count = agg._count;
      const dailyAvg = count > 0 ? revenue / 7 : 0;
      const avgSale = count > 0 ? revenue / count : 0;
      return `📈 **Last 7 Days Sales**\n\n| Metric | Value |\n|---|---|\n| Revenue | ${bdt(revenue)} |\n| Transactions | ${fmtNum(count)} |\n| Daily avg revenue | ${bdt(dailyAvg)} |\n| Avg sale value | ${bdt(avgSale)} |\n\n📅 Period: ${fmtDate(start)} → ${fmtDate(end)}`;
    },
  },

  // 15. recent-purchases
  {
    name: "recent-purchases",
    description: "Last 5 purchases. Uses 'select' only (can't combine 'include' and 'select' in Prisma).",
    keywords: ["recent purchases", "latest purchases", "last purchases", "recent po", "recent orders", "last 5 purchases"],
    matchMode: "any",
    handler: async (businessId) => {
      // IMPORTANT: cannot use both 'include' and 'select' — use 'select' only.
      const purchases = await db.purchase.findMany({
        where: { businessId, status: { not: "cancelled" } },
        select: {
          id: true,
          purchaseNo: true,
          totalAmount: true,
          paidAmount: true,
          paymentStatus: true,
          receivedDate: true,
          createdAt: true,
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (purchases.length === 0) {
        return "🛒 **Recent Purchases**\n\nNo purchases recorded yet.";
      }
      const lines = purchases
        .map((p, i) => {
          const supplier = p.supplier?.name || "Unknown supplier";
          const date = p.receivedDate || p.createdAt;
          return `${i + 1}. **${p.purchaseNo}** — ${supplier} • ${bdt(p.totalAmount)} (paid: ${bdt(p.paidAmount)}, status: ${p.paymentStatus}) • dated ${fmtDate(date)}`;
        })
        .join("\n");
      return `🛒 **Last 5 Purchases**\n\n${lines}`;
    },
  },

  // 16. categories
  {
    name: "categories",
    description: "Category list with product count per category.",
    keywords: ["categories", "category list", "list categories", "all categories", "how many categories"],
    matchMode: "any",
    handler: async (businessId) => {
      const categories = await db.category.findMany({
        where: { businessId, isActive: true },
        select: {
          id: true,
          name: true,
          type: true,
          icon: true,
          _count: { select: { products: true } },
        },
        orderBy: { sortOrder: "asc" },
      });
      if (categories.length === 0) {
        return "🏷️ **Categories**\n\nNo categories defined yet.";
      }
      const totalProducts = categories.reduce((s, c) => s + c._count.products, 0);
      const lines = categories
        .map(
          (c, i) =>
            `${i + 1}. **${c.name}** (${c.type}) — ${fmtNum(c._count.products)} product(s)`
        )
        .join("\n");
      return `🏷️ **Categories**\n\nFound **${categories.length}** active categories with **${fmtNum(totalProducts)}** products total:\n\n${lines}`;
    },
  },

  // 17. today-purchases
  {
    name: "today-purchases",
    description: "Today's total spend, purchase count, and average purchase value.",
    keywords: ["today purchases", "todays purchases", "purchases today", "today spend", "today buying", "today received"],
    matchMode: "any",
    handler: async (businessId) => {
      const start = startOfTodayUTC();
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      const agg = await db.purchase.aggregate({
        where: {
          businessId,
          status: { not: "cancelled" },
          createdAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
        _count: true,
      });
      const total = agg._sum.totalAmount || 0;
      const count = agg._count;
      const avg = count > 0 ? total / count : 0;
      return `🛍️ **Today's Purchases** (UTC ${fmtDate(start)})\n\n| Metric | Value |\n|---|---|\n| Total spend | ${bdt(total)} |\n| Purchase count | ${fmtNum(count)} |\n| Avg purchase | ${bdt(avg)} |\n\n${count > 0 ? "📦 Stock received today." : "💤 No purchases recorded today."}`;
    },
  },

  // 18. returns
  {
    name: "returns",
    description: "This month's refund total, count, and average refund.",
    keywords: ["returns", "refunds", "this month returns", "returned items", "refund total", "monthly returns"],
    matchMode: "any",
    handler: async (businessId) => {
      const start = startOfMonthUTC();
      const end = new Date();
      const agg = await db.return.aggregate({
        where: { businessId, createdAt: { gte: start, lte: end } },
        _sum: { refundAmount: true },
        _count: true,
      });
      const total = agg._sum.refundAmount || 0;
      const count = agg._count;
      const avg = count > 0 ? total / count : 0;
      return `↩️ **Returns This Month** (since ${fmtDate(start)})\n\n| Metric | Value |\n|---|---|\n| Refund total | ${bdt(total)} |\n| Return count | ${fmtNum(count)} |\n| Avg refund | ${bdt(avg)} |`;
    },
  },

  // 19. payments-received
  {
    name: "payments-received",
    description: "Today's collected payment amount, count, and average.",
    keywords: ["payments received", "payments today", "today payments", "collected today", "cash collected", "money received", "payment received"],
    matchMode: "any",
    handler: async (businessId) => {
      const start = startOfTodayUTC();
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      const agg = await db.payment.aggregate({
        where: { businessId, createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      });
      const total = agg._sum.amount || 0;
      const count = agg._count;
      const avg = count > 0 ? total / count : 0;
      return `💳 **Payments Received Today** (UTC ${fmtDate(start)})\n\n| Metric | Value |\n|---|---|\n| Total collected | ${bdt(total)} |\n| Payment count | ${fmtNum(count)} |\n| Avg payment | ${bdt(avg)} |`;
    },
  },

  // 20. dashboard-summary
  {
    name: "dashboard-summary",
    description: "Comprehensive overview: today sales, month sales, product count, low stock, expiring, expired, receivables, payables.",
    keywords: ["dashboard", "summary", "overview", "snapshot", "kpi", "business summary", "status report"],
    matchMode: "any",
    handler: async (businessId) => {
      const now = new Date();
      const todayStart = startOfTodayUTC();
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      const monthStart = startOfMonthUTC();

      const [
        todaySales,
        monthSales,
        productCount,
        lowStock,
        outOfStock,
        expiringSoon,
        expired,
        receivablesAgg,
        payablesAgg,
      ] = await Promise.all([
        db.sale.aggregate({
          where: { businessId, status: "completed", createdAt: { gte: todayStart, lte: todayEnd } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        db.sale.aggregate({
          where: { businessId, status: "completed", createdAt: { gte: monthStart } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        db.product.count({ where: { businessId, isActive: true } }),
        db.product.count({
          where: { businessId, isActive: true, inventory: { quantity: { lte: 10, gt: 0 } } },
        }),
        db.product.count({
          where: { businessId, isActive: true, inventory: { quantity: { lte: 0 } } },
        }),
        db.batch.count({
          where: {
            businessId,
            quantity: { gt: 0 },
            status: { notIn: ["expired", "destroyed"] },
            expiryDate: {
              gte: now,
              lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        db.batch.count({
          where: { businessId, quantity: { gt: 0 }, status: "expired" },
        }),
        db.sale.aggregate({
          where: {
            businessId,
            paymentStatus: { in: ["partial", "unpaid"] },
            status: "completed",
          },
          _sum: { totalAmount: true, paidAmount: true },
        }),
        db.supplier.aggregate({
          where: { businessId, balance: { gt: 0 } },
          _sum: { balance: true },
        }),
      ]);

      const todayRevenue = todaySales._sum.totalAmount || 0;
      const monthRevenue = monthSales._sum.totalAmount || 0;
      const receivables =
        (receivablesAgg._sum.totalAmount || 0) - (receivablesAgg._sum.paidAmount || 0);
      const payables = payablesAgg._sum.balance || 0;

      return `📊 **Business Dashboard Summary**\n\n### 💰 Sales\n| Metric | Value |\n|---|---|\n| Today's revenue | ${bdt(todayRevenue)} (${fmtNum(todaySales._count)} sales) |\n| This month's revenue | ${bdt(monthRevenue)} (${fmtNum(monthSales._count)} sales) |\n\n### 📦 Inventory\n| Metric | Count |\n|---|---|\n| Active products | ${fmtNum(productCount)} |\n| Low stock (≤10) | ${fmtNum(lowStock)} |\n| Out of stock (≤0) | ${fmtNum(outOfStock)} |\n| Expiring (≤90d) | ${fmtNum(expiringSoon)} |\n| Already expired | ${fmtNum(expired)} |\n\n### 💵 Outstanding\n| Metric | Value |\n|---|---|\n| Receivables (customers owe) | ${bdt(receivables)} |\n| Payables (owe suppliers) | ${bdt(payables)} |\n\n${expired > 0 ? "🚨 Action needed: dispose of expired stock." : lowStock > 0 ? "⚠️ Action needed: reorder low-stock items." : "✅ All clear — no critical alerts."}`;
    },
  },
];

// ── Public: route a message ──
export async function routeQuery(
  businessId: string,
  message: string
): Promise<RouteResult> {
  if (!message || !message.trim()) {
    return { handled: false };
  }
  const normalized = normalizeMessage(message);

  for (const pattern of PATTERNS) {
    if (!matchesPattern(normalized, pattern)) continue;

    const startMs = Date.now();
    try {
      const response = await pattern.handler(businessId, message);
      const queryMs = Date.now() - startMs;
      return {
        handled: true,
        pattern: pattern.name,
        response,
        queryMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[sql-router] pattern "${pattern.name}" threw:`, msg);
      // Don't surface the error to the user — let the LLM try instead.
      return { handled: false };
    }
  }

  return { handled: false };
}

// ── Public: list registered patterns (for debugging / super-admin UI) ──
export function getRegisteredPatterns(): PatternDescriptor[] {
  return PATTERNS.map((p) => ({
    name: p.name,
    description: p.description,
    keywords: p.keywords,
    matchMode: p.matchMode,
    excludeKeywords: p.excludeKeywords,
  }));
}
