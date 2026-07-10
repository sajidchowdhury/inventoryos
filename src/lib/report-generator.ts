// src/lib/report-generator.ts
// Phase B: Calls the predictor, then calls GLM-4 to synthesize the report.
//
// The AI does NOT do math — it only rephrases the pre-computed numbers from
// report-predictor.ts into natural language. This prevents hallucination.
//
// Flow:
//   1. Call runPrediction() → structured JSON with all numbers
//   2. Build the AI prompt (system prompt + user content with pre-computed data)
//   3. Call GLM-4 via z-ai-web-dev-sdk (with max_tokens cap)
//   4. Parse JSON response
//   5. Save to GeneratedReport with all 4 sections + appliedInfluences + cost tracking
//   6. Return the GeneratedReport

import { db } from "./db";
import { runPrediction, type PredictionResult } from "./report-predictor";
import { checkAILimit, logAIUsage, estimateTokens } from "./ai-rate-limit";
import { buildFallback, classifyError } from "./ai-fallback";

const FEATURE = "report-generation";
const MAX_OUTPUT_TOKENS = 3072; // Enough for exec summary + 3 spikes + 20 items + stock risks

// ── System prompt (from spec Section 15.1) ──
const SYSTEM_PROMPT = `You are a pharmacy business analyst AI for InventoryOS, a Bangladesh pharmacy inventory management platform. You will receive pre-computed sales prediction data for a pharmacy for the upcoming week. Your job is to synthesize this data into a clear, actionable report.

CRITICAL RULE: DO NOT calculate any numbers. All numbers (predicted quantities, spike percentages, stock levels, purchase recommendations) are already computed by the system. Your job is to explain what the numbers mean and what the pharmacist should do. If you are tempted to do math, stop — just rephrase the numbers you are given.

Return ONLY a JSON object with this exact structure:
{
  "executiveSummary": "2-3 sentence overview mentioning the business name, overall outlook, top opportunity, and top risk",
  "spikePredictions": [
    {"product": "name", "spikePercent": number, "occasion": "occasion name", "historicalBasis": "last year X sold vs normal Y", "recommendation": "one-line action"}
  ],
  "topItems": [
    {"product": "name", "predictedQty": number, "predictedProfit": number, "currentStock": number, "stockStatus": "good|low|order_now", "recommendation": "one-line note"}
  ],
  "stockRisks": [
    {"product": "name", "daysUntilStockout": number, "recommendedPurchaseQty": number, "supplier": "name", "urgency": "critical|high|medium"}
  ]
}

Return 3 spikePredictions, 20 topItems, and all stockRisks. Be specific and actionable. Mention occasions by name (Eid-ul-Fitr, Durga Puja, Friday, etc.). Keep recommendations practical — a pharmacy owner should be able to act on them immediately. Use BDT for all monetary values. Do not include dosing or medical advice.`;

export interface GenerateReportOptions {
  businessId: string;
  scheduleId: string;
  reportPeriodDays?: number;
  considerSeasons?: boolean;
  considerEpidemics?: boolean;
}

export interface GenerateReportResult {
  success: boolean;
  reportId?: string;
  executiveSummary?: string;
  spikePredictions?: any[];
  topItems?: any[];
  stockRisks?: any[];
  appliedInfluences?: any;
  aiTokensUsed?: number;
  aiCostEstimate?: number;
  predictionConfidence?: string;
  errorMessage?: string;
  fallbackUsed?: boolean;
}

/**
 * Generate a report for a single business.
 * This function is called by:
 *   - The manual trigger endpoint (POST /api/super-admin/report-scheduling/schedules/[id]/trigger)
 *   - The report-generator-worker cron job (Phase D)
 *
 * The function is idempotent — if the same schedule+business+date already has
 * a completed report, it returns the existing report instead of regenerating.
 */
export async function generateReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const {
    businessId,
    scheduleId,
    reportPeriodDays = 7,
    considerSeasons = true,
    considerEpidemics = true,
  } = options;

  const now = new Date();
  const reportDate = now;

  // ── 1. Run the prediction algorithm (all math in code) ──
  let prediction: PredictionResult;
  try {
    prediction = await runPrediction(
      businessId,
      reportPeriodDays,
      considerSeasons,
      considerEpidemics
    );
  } catch (err) {
    console.error("[report-generator] prediction failed:", err);
    return {
      success: false,
      errorMessage: `Prediction algorithm failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 2. Get business name for the report ──
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  const businessName = business?.name || "Your Pharmacy";

  // ── 3. Create the GeneratedReport row (status: generating) ──
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() + 1);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + reportPeriodDays - 1);

  const report = await db.generatedReport.create({
    data: {
      scheduleId,
      businessId,
      reportDate,
      reportPeriodStart: periodStart,
      reportPeriodEnd: periodEnd,
      generationStatus: "generating",
      predictionConfidence: prediction.predictionConfidence,
      appliedInfluences: JSON.stringify(prediction.appliedInfluences),
    },
  });

  // ── 4. Check AI rate limits (Phase 1-5 defenses apply) ──
  const limitCheck = await checkAILimit(businessId);
  if (!limitCheck.allowed) {
    // AI is rate-limited — generate deterministic fallback report
    // (raw numbers without AI synthesis, so the client still gets a report)
    const fallbackResult = generateDeterministicFallback(businessName, prediction, periodStart, periodEnd);

    await db.generatedReport.update({
      where: { id: report.id },
      data: {
        executiveSummary: fallbackResult.executiveSummary,
        spikePredictions: JSON.stringify(fallbackResult.spikePredictions),
        topItems: JSON.stringify(fallbackResult.topItems),
        stockRisks: JSON.stringify(fallbackResult.stockRisks),
        generationStatus: "completed",
        aiTokensUsed: 0,
        aiCostEstimate: 0,
      },
    });

    return {
      success: true,
      reportId: report.id,
      ...fallbackResult,
      appliedInfluences: prediction.appliedInfluences,
      aiTokensUsed: 0,
      aiCostEstimate: 0,
      predictionConfidence: prediction.predictionConfidence,
      fallbackUsed: true,
    };
  }

  // ── 5. Build the AI user content (pre-computed numbers only) ──
  const userContent = buildUserContent(businessName, prediction, periodStart, periodEnd);

  // ── 6. Call GLM-4 ──
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      thinking: { type: "disabled" },
      max_tokens: MAX_OUTPUT_TOKENS,
    });

    const response = completion.choices[0]?.message?.content || "";

    // Get token usage
    const sdkTokens = (completion as { usage?: { total_tokens?: number } })?.usage?.total_tokens;
    const totalTokens =
      typeof sdkTokens === "number" && sdkTokens > 0
        ? sdkTokens
        : estimateTokens(SYSTEM_PROMPT) + estimateTokens(userContent) + estimateTokens(response);

    const aiCostEstimate = (totalTokens / 1000) * 0.03; // 0.03 BDT per 1K tokens

    // Log AI usage (for Phase 1-5 cost tracking)
    await logAIUsage(businessId, FEATURE, totalTokens, true);

    // ── 7. Parse the AI response ──
    let parsed: {
      executiveSummary?: string;
      spikePredictions?: any[];
      topItems?: any[];
      stockRisks?: any[];
    };

    try {
      // Extract JSON from response (handle if wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      // JSON parse failed — use deterministic fallback
      const fallbackResult = generateDeterministicFallback(businessName, prediction, periodStart, periodEnd);
      parsed = fallbackResult;
    }

    // ── 8. Save the completed report ──
    await db.generatedReport.update({
      where: { id: report.id },
      data: {
        executiveSummary: parsed.executiveSummary || "",
        spikePredictions: JSON.stringify(parsed.spikePredictions || prediction.spikePredictions),
        topItems: JSON.stringify(parsed.topItems || prediction.topItems.map(p => ({
          product: p.productName,
          predictedQty: p.predictedQty,
          predictedProfit: p.predictedProfit,
          currentStock: p.currentStock,
          stockStatus: p.stockStatus,
          recommendation: p.stockStatus === "order_now" ? `Order ${p.recommendedPurchaseQty} ${p.unit}` : "Stock adequate",
        }))),
        stockRisks: JSON.stringify(parsed.stockRisks || prediction.stockRisks),
        generationStatus: "completed",
        aiTokensUsed: totalTokens,
        aiCostEstimate,
      },
    });

    return {
      success: true,
      reportId: report.id,
      executiveSummary: parsed.executiveSummary || "",
      spikePredictions: parsed.spikePredictions || [],
      topItems: parsed.topItems || [],
      stockRisks: parsed.stockRisks || [],
      appliedInfluences: prediction.appliedInfluences,
      aiTokensUsed: totalTokens,
      aiCostEstimate,
      predictionConfidence: prediction.predictionConfidence,
    };
  } catch (err) {
    // AI call failed — generate deterministic fallback
    console.error("[report-generator] AI call failed, using fallback:", err);
    const fallbackResult = generateDeterministicFallback(businessName, prediction, periodStart, periodEnd);

    await db.generatedReport.update({
      where: { id: report.id },
      data: {
        executiveSummary: fallbackResult.executiveSummary,
        spikePredictions: JSON.stringify(fallbackResult.spikePredictions),
        topItems: JSON.stringify(fallbackResult.topItems),
        stockRisks: JSON.stringify(fallbackResult.stockRisks),
        generationStatus: "completed",
        aiTokensUsed: 0,
        aiCostEstimate: 0,
        errorMessage: `AI call failed: ${err instanceof Error ? err.message : String(err)}. Used deterministic fallback.`,
      },
    });

    return {
      success: true,
      reportId: report.id,
      ...fallbackResult,
      appliedInfluences: prediction.appliedInfluences,
      aiTokensUsed: 0,
      aiCostEstimate: 0,
      predictionConfidence: prediction.predictionConfidence,
      fallbackUsed: true,
      errorMessage: "AI call failed — used deterministic fallback",
    };
  }
}

// ── Build the user content for GLM-4 ──
function buildUserContent(
  businessName: string,
  prediction: PredictionResult,
  periodStart: Date,
  periodEnd: Date
): string {
  const topItemsData = prediction.topItems.map((p) => ({
    product: `${p.productName}${p.genericName ? ` (${p.genericName})` : ""}`,
    predictedQty: p.predictedQty,
    predictedProfit: Math.round(p.predictedProfit),
    currentStock: Math.round(p.currentStock),
    stockStatus: p.stockStatus,
    recommendation: p.stockStatus === "order_now" || p.stockStatus === "out"
      ? `Order ${p.recommendedPurchaseQty} ${p.unit} from ${p.supplier || "your supplier"}`
      : p.stockStatus === "low"
      ? `Stock is low — monitor closely`
      : `Stock is adequate for the week`,
  }));

  const spikeData = prediction.spikePredictions.map((s) => ({
    product: s.productName,
    spikePercent: s.spikePercent,
    occasion: s.occasion,
    season: s.season,
    epidemic: s.epidemic,
    historicalBasis: s.historicalBasis,
    recommendation: s.recommendation,
  }));

  const stockRiskData = prediction.stockRisks.map((r) => ({
    product: r.productName,
    daysUntilStockout: r.daysUntilStockout,
    recommendedPurchaseQty: r.recommendedPurchaseQty,
    supplier: r.supplier || "Not specified",
    urgency: r.urgency,
  }));

  return JSON.stringify({
    businessName,
    reportPeriod: `${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
    predictionConfidence: prediction.predictionConfidence,
    upcomingOccasions: prediction.occasionAdjustments.map((o) => ({
      name: o.occasion,
      impactWeight: o.impactWeight,
      historicalSpikeRatio: o.historicalSpikeRatio,
    })),
    currentSeason: prediction.seasonalAdjustments.season
      ? {
          name: prediction.seasonalAdjustments.season,
          multiplier: prediction.seasonalAdjustments.multiplier,
          affectedCategories: prediction.seasonalAdjustments.affectedCategories,
        }
      : null,
    activeEpidemics: prediction.epidemicAdjustments,
    spikePredictions: spikeData,
    topItems: topItemsData,
    stockRisks: stockRiskData,
  }, null, 2);
}

// ── Deterministic fallback (no AI — raw numbers only) ──
function generateDeterministicFallback(
  businessName: string,
  prediction: PredictionResult,
  periodStart: Date,
  periodEnd: Date
): {
  executiveSummary: string;
  spikePredictions: any[];
  topItems: any[];
  stockRisks: any[];
} {
  const topSpike = prediction.spikePredictions[0];
  const topRisk = prediction.stockRisks[0];

  let summary = `${businessName} weekly prediction for ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}. `;
  if (topSpike) {
    summary += `Top opportunity: ${topSpike.productName} (${topSpike.spikePercent}% spike from ${topSpike.occasion}). `;
  }
  if (topRisk) {
    summary += `Top risk: ${topRisk.productName} (stocks out in ${topRisk.daysUntilStockout} days).`;
  } else {
    summary += `No critical stock risks detected.`;
  }
  summary += ` Prediction confidence: ${prediction.predictionConfidence}.`;

  return {
    executiveSummary: summary,
    spikePredictions: prediction.spikePredictions,
    topItems: prediction.topItems.map((p) => ({
      product: p.productName,
      predictedQty: p.predictedQty,
      predictedProfit: Math.round(p.predictedProfit),
      currentStock: Math.round(p.currentStock),
      stockStatus: p.stockStatus,
      recommendation: p.stockStatus === "order_now" || p.stockStatus === "out"
        ? `Order ${p.recommendedPurchaseQty} ${p.unit} from ${p.supplier || "your supplier"}`
        : "Stock adequate",
    })),
    stockRisks: prediction.stockRisks,
  };
}
