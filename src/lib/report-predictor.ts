// src/lib/report-predictor.ts
// Phase B: The 5-step AI prediction algorithm.
//
// This module does ALL the math in code (no LLM). The AI's job (in
// report-generator.ts) is only to rephrase these pre-computed numbers
// into natural language. This prevents hallucination.
//
// The 5 steps:
//   1. Base demand calculation (30-day moving average per product)
//   2. Seasonal adjustment (current season's multiplier on affected categories)
//   3. Occasion overlay (historical spike ratio from same occasion last year)
//   4. Epidemic override (active outbreak multipliers)
//   5. Stock gap analysis (predicted demand vs current stock → purchase recs)
//
// Output: structured JSON that report-generator.ts passes to GLM-4.

import { db } from "./db";

// ── Types ──
export interface ProductPrediction {
  productId: string;
  productName: string;
  genericName: string | null;
  category: string | null;
  unit: string;
  baselineDaily: number;      // Step 1: 30-day moving average
  baselineWeekly: number;     // baselineDaily * 7
  seasonalMultiplier: number; // Step 2: current season's multiplier (1.0 if no season)
  occasionMultiplier: number; // Step 3: occasion spike ratio (1.0 if no occasion)
  epidemicMultiplier: number; // Step 4: epidemic multiplier (1.0 if no epidemic)
  combinedMultiplier: number; // seasonal * occasion * epidemic
  predictedDaily: number;     // baselineDaily * combinedMultiplier
  predictedQty: number;       // predictedDaily * reportPeriodDays
  predictedRevenue: number;   // predictedQty * mrp
  predictedProfit: number;    // predictedRevenue - (predictedQty * avgCost)
  spikePercent: number;       // (combinedMultiplier - 1) * 100
  currentStock: number;
  stockStatus: "good" | "low" | "order_now" | "out";
  daysUntilStockout: number | null;
  recommendedPurchaseQty: number;
  supplier: string | null;
  mrp: number | null;
  avgCost: number;
}

export interface SpikePrediction {
  productId: string;
  productName: string;
  spikePercent: number;
  occasion: string;
  season: string | null;
  epidemic: string | null;
  historicalBasis: string;
  recommendation: string;
}

export interface StockRisk {
  productId: string;
  productName: string;
  daysUntilStockout: number | null;
  recommendedPurchaseQty: number;
  supplier: string | null;
  urgency: "critical" | "high" | "medium";
}

export interface PredictionResult {
  baseDemand: Array<{ productId: string; productName: string; baselineDaily: number }>;
  seasonalAdjustments: {
    season: string | null;
    multiplier: number;
    affectedCategories: string[];
  };
  occasionAdjustments: Array<{
    date: string;
    occasion: string;
    impactWeight: number;
    historicalSpikeRatio: number | null;
  }>;
  epidemicAdjustments: Array<{
    name: string;
    multiplier: number;
    affectedCategories: string[];
  }>;
  predictions: ProductPrediction[];
  topItems: ProductPrediction[];       // top 20 by predictedProfit
  spikePredictions: SpikePrediction[]; // top 3 by spikePercent
  stockRisks: StockRisk[];
  predictionConfidence: "low" | "medium" | "high";
  appliedInfluences: {
    seasons: string[];
    occasions: string[];
    epidemics: string[];
  };
}

// ── Helper: get current season ──
async function getCurrentSeason(now: Date): Promise<{
  name: string;
  multiplier: number;
  affectedCategories: string[];
} | null> {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  const seasons = await db.reportSeason.findMany({
    where: { isActive: true },
  });

  for (const season of seasons) {
    // Handle year-wrap (Winter: Dec-Feb)
    const startMonth = season.startMonth;
    const endMonth = season.endMonth;

    let inSeason = false;
    if (startMonth <= endMonth) {
      // Same year (e.g., Summer: Mar-May)
      if (month > startMonth && month < endMonth) inSeason = true;
      if (month === startMonth && day >= season.startDay) inSeason = true;
      if (month === endMonth && day <= season.endDay) inSeason = true;
    } else {
      // Year-wrap (e.g., Winter: Dec-Feb)
      if (month >= startMonth || month <= endMonth) {
        if (month === startMonth && day < season.startDay) inSeason = false;
        else if (month === endMonth && day > season.endDay) inSeason = false;
        else inSeason = true;
      }
    }

    if (inSeason) {
      return {
        name: season.name,
        multiplier: season.impactWeight,
        affectedCategories: JSON.parse(season.affectedCategories || "[]"),
      };
    }
  }
  return null;
}

// ── Helper: get upcoming occasions in prediction period ──
async function getUpcomingOccasions(
  startDate: Date,
  endDate: Date
): Promise<Array<{
  date: Date;
  occasionId: string;
  occasionName: string;
  occasionSlug: string;
  impactWeight: number;
  durationDays: number;
  leadDays: number;
}>> {
  const holidays = await db.holidayCalendar.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    include: { occasion: true },
  });

  // Also check recurring weekly occasions (Friday, Saturday)
  const allOccasions = await db.reportOccasion.findMany({
    where: { isActive: true, datePattern: "recurring_weekly" },
  });

  const upcoming: Array<any> = [];

  // Add specific-date holidays
  for (const h of holidays) {
    if (!h.occasion.isActive) continue;
    upcoming.push({
      date: h.date,
      occasionId: h.occasionId,
      occasionName: h.occasion.name,
      occasionSlug: h.occasion.slug,
      impactWeight: h.occasion.impactWeight,
      durationDays: h.occasion.durationDays,
      leadDays: h.occasion.leadDays,
    });
  }

  // Add recurring weekly occasions
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    for (const occ of allOccasions) {
      if (occ.weeklyDayOfWeek === dayOfWeek) {
        upcoming.push({
          date: new Date(d),
          occasionId: occ.id,
          occasionName: occ.name,
          occasionSlug: occ.slug,
          impactWeight: occ.impactWeight,
          durationDays: occ.durationDays,
          leadDays: occ.leadDays,
        });
      }
    }
  }

  return upcoming;
}

// ── Helper: get active epidemics ──
async function getActiveEpidemics(now: Date): Promise<Array<{
  name: string;
  multiplier: number;
  affectedCategories: string[];
  affectedProducts: string[];
}>> {
  const epidemics = await db.epidemicAlert.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  return epidemics.map((e) => ({
    name: e.name,
    multiplier: e.impactWeight,
    affectedCategories: JSON.parse(e.affectedCategories || "[]"),
    affectedProducts: JSON.parse(e.affectedProducts || "[]"),
  }));
}

// ── Helper: get historical spike ratio for an occasion ──
// Looks up the same occasion in the previous year and compares sales
// during the occasion window to a normal window 4 weeks before.
async function getHistoricalSpikeRatio(
  businessId: string,
  occasionName: string,
  occasionDate: Date,
  durationDays: number
): Promise<number | null> {
  // Look for the same occasion in the previous year
  const lastYearDate = new Date(occasionDate);
  lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);

  // Find the occasion in last year's holiday calendar
  const lastYearHoliday = await db.holidayCalendar.findFirst({
    where: {
      occasion: { name: occasionName },
      date: {
        gte: new Date(lastYearDate.getFullYear(), lastYearDate.getMonth(), lastYearDate.getDate() - 7),
        lte: new Date(lastYearDate.getFullYear(), lastYearDate.getMonth(), lastYearDate.getDate() + 7),
      },
    },
  });

  if (!lastYearHoliday) return null;

  const occDate = lastYearHoliday.date;
  const occasionStart = new Date(occDate);
  occasionStart.setDate(occasionStart.getDate() - 3); // 3 days before
  const occasionEnd = new Date(occDate);
  occasionEnd.setDate(occasionEnd.getDate() + durationDays); // duration after

  // Normal window: 4 weeks before the occasion
  const normalStart = new Date(occasionStart);
  normalStart.setDate(normalStart.getDate() - 28);
  const normalEnd = new Date(occasionStart);
  normalEnd.setDate(normalEnd.getDate() - 1);

  // Query sales for both windows
  const [occasionSales, normalSales] = await Promise.all([
    db.saleItem.aggregate({
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: occasionStart, lte: occasionEnd } },
      },
      _sum: { quantity: true },
    }),
    db.saleItem.aggregate({
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: normalStart, lte: normalEnd } },
      },
      _sum: { quantity: true },
    }),
  ]);

  const occasionQty = occasionSales._sum.quantity || 0;
  const normalQty = normalSales._sum.quantity || 0;

  if (normalQty === 0) return null;
  return occasionQty / normalQty;
}

// ── Main: runPrediction ──
export async function runPrediction(
  businessId: string,
  reportPeriodDays: number,
  considerSeasons: boolean = true,
  considerEpidemics: boolean = true
): Promise<PredictionResult> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() + 1); // Tomorrow
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + reportPeriodDays - 1);

  // ── Step 1: Base demand calculation ──
  // 30-day moving average, excluding the last 7 days (to avoid ongoing occasion skew)
  const baselineEnd = new Date(now);
  baselineEnd.setDate(baselineEnd.getDate() - 7); // 7 days ago
  const baselineStart = new Date(baselineEnd);
  baselineStart.setDate(baselineStart.getDate() - 30); // 37 days ago

  // Get all active products with their categories and inventory
  const products = await db.product.findMany({
    where: { businessId, isActive: true },
    include: {
      inventory: { select: { quantity: true } },
      category: { select: { name: true } },
    },
  });

  // Get 1-year of sales data for historical occasion lookup
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Get baseline period sales per product
  const baselineSales = await db.saleItem.groupBy({
    by: ["productId"],
    where: {
      businessId,
      sale: { status: "completed", createdAt: { gte: baselineStart, lte: baselineEnd } },
    },
    _sum: { quantity: true },
    _count: true,
  });

  const baselineMap = new Map(
    baselineSales.map((s) => [s.productId, s._sum.quantity || 0])
  );

  // ── Step 2: Seasonal adjustment ──
  const currentSeason = considerSeasons ? await getCurrentSeason(now) : null;

  // ── Step 3: Occasion overlay ──
  const upcomingOccasions = await getUpcomingOccasions(periodStart, periodEnd);

  // For each occasion, get historical spike ratio
  const occasionSpikeRatios: Array<{
    occasionName: string;
    spikeRatio: number | null;
    impactWeight: number;
  }> = [];
  for (const occ of upcomingOccasions) {
    const ratio = await getHistoricalSpikeRatio(
      businessId,
      occ.occasionName,
      occ.date,
      occ.durationDays
    );
    occasionSpikeRatios.push({
      occasionName: occ.occasionName,
      spikeRatio: ratio,
      impactWeight: occ.impactWeight,
    });
  }

  // Calculate combined occasion multiplier for the period
  // If multiple occasions overlap, use the highest spike ratio + 15% combination bonus
  let occasionMultiplier = 1.0;
  let topOccasionName = "";
  let topOccasionRatio = 1.0;
  for (const occ of occasionSpikeRatios) {
    const effectiveRatio = occ.spikeRatio || occ.impactWeight; // Fall back to default weight
    if (effectiveRatio > occasionMultiplier) {
      occasionMultiplier = effectiveRatio;
      topOccasionName = occ.occasionName;
      topOccasionRatio = effectiveRatio;
    }
  }
  // Combination bonus: if 2+ occasions, add 15%
  if (occasionSpikeRatios.length >= 2) {
    occasionMultiplier *= 1.15;
  }

  // ── Step 4: Epidemic override ──
  const activeEpidemics = considerEpidemics ? await getActiveEpidemics(now) : [];

  // ── Step 5: Build per-product predictions ──
  const predictions: ProductPrediction[] = [];

  // Get average cost per product from latest batch
  const productBatches = await db.batch.findMany({
    where: {
      businessId,
      quantity: { gt: 0 },
      status: { in: ["active", "near_expiry"] },
    },
    select: {
      productId: true,
      purchasePrice: true,
      mrp: true,
      supplierId: true,
      supplier: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Map: productId → { avgCost, mrp, supplier }
  const productInfoMap = new Map<string, { avgCost: number; mrp: number | null; supplier: string | null }>();
  for (const batch of productBatches) {
    if (!productInfoMap.has(batch.productId)) {
      productInfoMap.set(batch.productId, {
        avgCost: batch.purchasePrice || 0,
        mrp: batch.mrp,
        supplier: batch.supplier?.name || null,
      });
    }
  }

  for (const product of products) {
    const baselineQty = baselineMap.get(product.id) || 0;
    const baselineDaily = baselineQty / 30; // 30-day average
    const baselineWeekly = baselineDaily * 7;

    // Skip dormant products (no sales in 30 days)
    if (baselineDaily === 0 && !upcomingOccasions.length) continue;

    // Seasonal multiplier
    let seasonalMultiplier = 1.0;
    if (currentSeason && currentSeason.affectedCategories.length > 0) {
      const categoryName = product.category?.name || "";
      if (currentSeason.affectedCategories.some((c) =>
        categoryName.toLowerCase().includes(c.toLowerCase()) ||
        c.toLowerCase().includes(categoryName.toLowerCase())
      )) {
        seasonalMultiplier = currentSeason.multiplier;
      }
    }

    // Epidemic multiplier
    let epidemicMultiplier = 1.0;
    let epidemicName = "";
    for (const epidemic of activeEpidemics) {
      const categoryName = product.category?.name || "";
      const isAffected = epidemic.affectedCategories.some((c) =>
        categoryName.toLowerCase().includes(c.toLowerCase()) ||
        c.toLowerCase().includes(categoryName.toLowerCase())
      ) || epidemic.affectedProducts.includes(product.name);

      if (isAffected) {
        epidemicMultiplier = Math.max(epidemicMultiplier, epidemic.multiplier);
        epidemicName = epidemic.name;
      }
    }

    // Combined multiplier
    const combinedMultiplier = seasonalMultiplier * occasionMultiplier * epidemicMultiplier;

    const predictedDaily = baselineDaily * combinedMultiplier;
    const predictedQty = Math.round(predictedDaily * reportPeriodDays);

    const productInfo = productInfoMap.get(product.id);
    const avgCost = productInfo?.avgCost || 0;
    const mrp = productInfo?.mrp || product.mrp || 0;
    const supplier = productInfo?.supplier || null;

    const predictedRevenue = predictedQty * mrp;
    const predictedProfit = predictedRevenue - (predictedQty * avgCost);

    const spikePercent = Math.round((combinedMultiplier - 1) * 100);

    const currentStock = product.inventory?.quantity || 0;
    let stockStatus: "good" | "low" | "order_now" | "out" = "good";
    let daysUntilStockout: number | null = null;
    let recommendedPurchaseQty = 0;

    if (currentStock <= 0) {
      stockStatus = "out";
      daysUntilStockout = 0;
      recommendedPurchaseQty = Math.ceil(predictedQty * 1.2);
    } else if (predictedDaily > 0) {
      daysUntilStockout = Math.floor(currentStock / predictedDaily);
      if (currentStock < predictedQty * 1.2) {
        if (daysUntilStockout <= 2) {
          stockStatus = "order_now";
        } else {
          stockStatus = "low";
        }
        recommendedPurchaseQty = Math.ceil(predictedQty * 1.2 - currentStock);
        // Round up to nearest strip/box size
        if (product.stripSize && product.stripSize > 0) {
          recommendedPurchaseQty = Math.ceil(recommendedPurchaseQty / product.stripSize) * product.stripSize;
        }
      }
    }

    predictions.push({
      productId: product.id,
      productName: product.name,
      genericName: product.genericName,
      category: product.category?.name || null,
      unit: product.unit,
      baselineDaily,
      baselineWeekly,
      seasonalMultiplier,
      occasionMultiplier,
      epidemicMultiplier,
      combinedMultiplier,
      predictedDaily,
      predictedQty,
      predictedRevenue,
      predictedProfit,
      spikePercent,
      currentStock,
      stockStatus,
      daysUntilStockout,
      recommendedPurchaseQty,
      supplier,
      mrp,
      avgCost,
    });
  }

  // ── Build top items (top 20 by predicted profit) ──
  const topItems = [...predictions]
    .sort((a, b) => b.predictedProfit - a.predictedProfit)
    .slice(0, 20);

  // ── Build spike predictions (top 3 by spike percent, excluding 0%) ──
  const spikePredictions: SpikePrediction[] = [...predictions]
    .filter((p) => p.spikePercent > 0)
    .sort((a, b) => b.spikePercent - a.spikePercent)
    .slice(0, 3)
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      spikePercent: p.spikePercent,
      occasion: topOccasionName || "None",
      season: currentSeason?.name || null,
      epidemic: activeEpidemics.length > 0 ? activeEpidemics[0].name : null,
      historicalBasis: topOccasionRatio > 1
        ? `Last year ${topOccasionName}: ${topOccasionRatio.toFixed(1)}x normal sales`
        : "Based on occasion impact weight",
      recommendation: p.stockStatus === "order_now" || p.stockStatus === "out"
        ? `Order ${p.recommendedPurchaseQty} ${p.unit} from ${p.supplier || "your supplier"}`
        : p.stockStatus === "low"
        ? `Stock is low — monitor closely`
        : "Stock is adequate",
    }));

  // ── Build stock risks (sorted by urgency) ──
  const stockRisks: StockRisk[] = predictions
    .filter((p) => p.stockStatus === "order_now" || p.stockStatus === "out" || p.stockStatus === "low")
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      daysUntilStockout: p.daysUntilStockout,
      recommendedPurchaseQty: p.recommendedPurchaseQty,
      supplier: p.supplier,
      urgency: p.stockStatus === "out" || (p.daysUntilStockout !== null && p.daysUntilStockout <= 2)
        ? "critical" as const
        : p.daysUntilStockout !== null && p.daysUntilStockout <= 4
        ? "high" as const
        : "medium" as const,
    }))
    .sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

  // ── Determine prediction confidence ──
  // Count how many days of sales data the business has
  const oldestSale = await db.saleItem.findFirst({
    where: { businessId },
    orderBy: { sale: { createdAt: "asc" } },
    select: { sale: { select: { createdAt: true } } },
  });

  let predictionConfidence: "low" | "medium" | "high" = "low";
  if (oldestSale?.sale?.createdAt) {
    const daysOfData = Math.floor((now.getTime() - oldestSale.sale.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    if (daysOfData >= 365) predictionConfidence = "high";
    else if (daysOfData >= 90) predictionConfidence = "medium";
    else predictionConfidence = "low";
  }

  return {
    baseDemand: predictions.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      baselineDaily: p.baselineDaily,
    })),
    seasonalAdjustments: {
      season: currentSeason?.name || null,
      multiplier: currentSeason?.multiplier || 1.0,
      affectedCategories: currentSeason?.affectedCategories || [],
    },
    occasionAdjustments: occasionSpikeRatios.map((o) => ({
      date: periodStart.toISOString(),
      occasion: o.occasionName,
      impactWeight: o.impactWeight,
      historicalSpikeRatio: o.spikeRatio,
    })),
    epidemicAdjustments: activeEpidemics.map((e) => ({
      name: e.name,
      multiplier: e.multiplier,
      affectedCategories: e.affectedCategories,
    })),
    predictions,
    topItems,
    spikePredictions,
    stockRisks,
    predictionConfidence,
    appliedInfluences: {
      seasons: currentSeason ? [currentSeason.name] : [],
      occasions: occasionSpikeRatios.map((o) => o.occasionName),
      epidemics: activeEpidemics.map((e) => e.name),
    },
  };
}
