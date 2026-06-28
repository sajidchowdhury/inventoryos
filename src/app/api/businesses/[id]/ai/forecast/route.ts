// POST /api/businesses/[id]/ai/forecast
// Predicts future sales demand per product using historical data + LLM analysis
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json().catch(() => ({}));
    const forecastDays = body.days || 30;

    const now = new Date();

    // Fetch last 90 days of sale items for trend analysis
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const saleItems = await db.saleItem.findMany({
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: ninetyDaysAgo } },
      },
      select: {
        productId: true, productName: true, quantity: true, totalPrice: true,
        saleId: true,
      },
    });

    // Fetch the actual sale dates for time-based analysis
    const sales = await db.sale.findMany({
      where: { businessId, status: "completed", createdAt: { gte: ninetyDaysAgo } },
      select: { id: true, createdAt: true },
    });
    const saleDateMap = new Map(sales.map((s) => [s.id, s.createdAt]));

    // Group by product and calculate trends
    const productDataMap = new Map<string, {
      productId: string;
      productName: string;
      dailySales: number[]; // 90 buckets, one per day
      totalSold: number;
      totalRevenue: number;
      saleDays: number;
    }>();

    // Initialize 90-day buckets for each product that has sales
    saleItems.forEach((item) => {
      if (!productDataMap.has(item.productId)) {
        productDataMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          dailySales: new Array(90).fill(0),
          totalSold: 0,
          totalRevenue: 0,
          saleDays: 0,
        });
      }
      const data = productDataMap.get(item.productId)!;
      data.totalSold += item.quantity;
      data.totalRevenue += item.totalPrice;

      const saleDate = saleDateMap.get(item.saleId);
      if (saleDate) {
        const dayIndex = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < 90) {
          if (data.dailySales[89 - dayIndex] === 0) data.saleDays++;
          data.dailySales[89 - dayIndex] += item.quantity;
        }
      }
    });

    // Also fetch products with no sales (for reorder context)
    const allActiveProducts = await db.product.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true, name: true, genericName: true, unit: true, mrp: true,
        inventory: { select: { quantity: true } },
        category: { select: { name: true, color: true } },
      },
    });

    // Calculate forecast for each product with sales history
    const forecasts = [];

    for (const [productId, data] of productDataMap) {
      const product = allActiveProducts.find((p) => p.id === productId);
      if (!product) continue;

      // Calculate metrics
      const avgDailySales = data.totalSold / 90;
      const last30Days = data.dailySales.slice(60).reduce((a, b) => a + b, 0);
      const prev30Days = data.dailySales.slice(30, 60).reduce((a, b) => a + b, 0);
      const last7Days = data.dailySales.slice(83).reduce((a, b) => a + b, 0);

      // Trend calculation
      let trend: "increasing" | "decreasing" | "stable" = "stable";
      if (last30Days > prev30Days * 1.15) trend = "increasing";
      else if (last30Days < prev30Days * 0.85) trend = "decreasing";

      // Day-of-week pattern
      const dowSales = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
      data.dailySales.forEach((qty, idx) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (89 - idx));
        dowSales[date.getDay()] += qty;
      });
      const totalDow = dowSales.reduce((a, b) => a + b, 0);
      const dowPattern = dowSales.map((qty) => ({
        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dowSales.indexOf(qty)],
        percentage: totalDow > 0 ? Math.round((qty / totalDow) * 100) : 0,
      }));
      // Fix: properly map
      const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dowData = dowSales.map((qty, i) => ({
        day: dowLabels[i],
        percentage: totalDow > 0 ? Math.round((qty / totalDow) * 100) : 0,
      }));
      const peakDay = dowData.reduce((max, d) => d.percentage > max.percentage ? d : max, dowData[0]);

      // Forecast calculation
      const trendMultiplier = trend === "increasing" ? 1.15 : trend === "decreasing" ? 0.85 : 1.0;
      const forecastedSales = Math.round(avgDailySales * forecastDays * trendMultiplier);
      const forecastedRevenue = forecastedSales * (product.mrp || 0);

      // Confidence based on data availability
      const confidence = Math.min(95, Math.round((data.saleDays / 90) * 100));

      // Current stock context
      const currentStock = product.inventory?.quantity || 0;
      const daysOfStock = avgDailySales > 0 ? Math.floor(currentStock / avgDailySales) : null;

      forecasts.push({
        productId,
        productName: product.name,
        genericName: product.genericName,
        category: product.category,
        unit: product.unit,
        mrp: product.mrp,
        currentStock,
        // Historical data
        totalSold90d: data.totalSold,
        totalRevenue90d: Math.round(data.totalRevenue * 100) / 100,
        avgDailySales: Math.round(avgDailySales * 10) / 10,
        last7Days,
        last30Days,
        prev30Days,
        // Forecast
        forecastDays,
        forecastedSales,
        forecastedRevenue: Math.round(forecastedRevenue * 100) / 100,
        trend,
        trendPercent: prev30Days > 0 ? Math.round(((last30Days - prev30Days) / prev30Days) * 100) : 0,
        confidence,
        // Pattern
        peakDay: peakDay.day,
        peakDayPercent: peakDay.percentage,
        dowPattern: dowData,
        // Stock alert
        daysOfStock,
        willStockOut: daysOfStock !== null && daysOfStock < forecastDays,
        stockoutDay: daysOfStock !== null && daysOfStock < forecastDays ? daysOfStock : null,
      });
    }

    // Sort by forecasted sales (highest first)
    forecasts.sort((a, b) => b.forecastedSales - a.forecastedSales);

    // Summary
    const summary = {
      productsAnalyzed: forecasts.length,
      totalForecastedSales: forecasts.reduce((s, f) => s + f.forecastedSales, 0),
      totalForecastedRevenue: forecasts.reduce((s, f) => s + f.forecastedRevenue, 0),
      increasingTrend: forecasts.filter((f) => f.trend === "increasing").length,
      decreasingTrend: forecasts.filter((f) => f.trend === "decreasing").length,
      willStockOut: forecasts.filter((f) => f.willStockOut).length,
      avgConfidence: forecasts.length > 0
        ? Math.round(forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      forecastDays,
      generatedAt: now.toISOString(),
      summary,
      forecasts,
    });
  } catch (error) {
    console.error("AI forecast error:", error);
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }
}
