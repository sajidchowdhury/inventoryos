// POST /api/businesses/[id]/ai/expiry-optimizer
// Analyzes near-expiry batches and recommends optimal actions using LLM
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Fetch all batches expiring within 90 days (or already expired) with stock
    const batches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        status: { in: ["active", "near_expiry", "expired"] },
        expiryDate: { lte: ninetyDaysFromNow },
      },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            unit: true, mrp: true, manufacturer: true,
            scheduleType: true, isPrescription: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No batches expiring within 90 days. Your inventory is healthy!",
        recommendations: [],
        summary: { totalBatches: 0, totalValueAtRisk: 0, criticalCount: 0 },
      });
    }

    // Calculate data for each batch
    const batchData = batches.map((batch) => {
      const daysUntilExpiry = Math.floor(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const valueAtRisk = (batch.mrp || 0) * batch.quantity;
      const costValue = (batch.purchasePrice || 0) * batch.quantity;

      // Calculate recent sales velocity for this product (last 30 days)
      const dailyVelocity = 0; // Will be filled by LLM context

      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        productId: batch.product.id,
        productName: batch.product.name,
        genericName: batch.product.genericName,
        strength: batch.product.strength,
        manufacturer: batch.product.manufacturer,
        category: batch.product.category,
        unit: batch.product.unit,
        mrp: batch.mrp,
        purchasePrice: batch.purchasePrice,
        scheduleType: batch.product.scheduleType,
        isPrescription: batch.product.isPrescription,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate.toISOString().split("T")[0],
        daysUntilExpiry,
        status: batch.status,
        valueAtRisk: Math.round(valueAtRisk * 100) / 100,
        costValue: Math.round(costValue * 100) / 100,
      };
    });

    // Calculate total value at risk
    const totalValueAtRisk = batchData.reduce((sum, b) => sum + b.valueAtRisk, 0);
    const expiredBatches = batchData.filter((b) => b.daysUntilExpiry < 0);
    const criticalBatches = batchData.filter((b) => b.daysUntilExpiry >= 0 && b.daysUntilExpiry <= 7);
    const warningBatches = batchData.filter((b) => b.daysUntilExpiry > 7 && b.daysUntilExpiry <= 30);
    const noticeBatches = batchData.filter((b) => b.daysUntilExpiry > 30 && b.daysUntilExpiry <= 90);

    // ── Call LLM for action recommendations ──
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const systemPrompt = `You are a pharmaceutical inventory optimization expert. Analyze the provided batch expiry data and recommend specific actions for each batch.

For each batch, recommend ONE of these actions:
- "sell_priority" — Prioritize selling via FEFO (for batches with enough time)
- "discount" — Offer a discount to sell faster (specify percentage)
- "return_supplier" — Return to supplier if possible (for batches that won't sell in time)
- "donate" — Donate to charity/NGO (for near-expiry that can't be sold)
- "dispose" — Safe disposal (for expired batches)
- "quarantine" — Quarantine for quality review

Return a JSON array where each element has:
{
  "batchId": "the batch ID",
  "action": "one of the actions above",
  "discountPercent": number or null (only if action is "discount"),
  "reason": "Short explanation of why this action",
  "urgency": "critical" | "high" | "medium" | "low",
  "estimatedRecovery": "How much money can be recovered (e.g., '60% via discount' or 'Full refund from supplier')"
}

Consider:
- Days until expiry (expired batches must be disposed)
- Quantity vs. likely sell-through rate
- Prescription vs OTC (OTC easier to discount)
- Schedule type (Schedule H/X have stricter rules)
- Value at risk (higher value = more effort to recover)

Be practical and pharmacy-specific. Return only the JSON array.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: `Analyze these expiring batches:\n\n${JSON.stringify(batchData, null, 2)}` },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content;

    // Parse recommendations
    let recommendations;
    try {
      const jsonMatch = response?.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      recommendations = [];
    }

    // Merge batch data with recommendations
    const enrichedRecommendations = batchData.map((batch) => {
      const rec = recommendations.find((r: { batchId: string }) => r.batchId === batch.batchId) || {};
      return {
        ...batch,
        action: rec.action || (batch.daysUntilExpiry < 0 ? "dispose" : "sell_priority"),
        discountPercent: rec.discountPercent || null,
        reason: rec.reason || "No recommendation available",
        urgency: rec.urgency || (batch.daysUntilExpiry < 0 ? "critical" : batch.daysUntilExpiry <= 7 ? "critical" : batch.daysUntilExpiry <= 30 ? "high" : "medium"),
        estimatedRecovery: rec.estimatedRecovery || "Unknown",
      };
    });

    // Sort by urgency then by days until expiry
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    enrichedRecommendations.sort((a, b) => {
      const uDiff = urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
      if (uDiff !== 0) return uDiff;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });

    // Summary by action
    const actionSummary = enrichedRecommendations.reduce((acc, r) => {
      acc[r.action] = (acc[r.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      summary: {
        totalBatches: batchData.length,
        totalValueAtRisk: Math.round(totalValueAtRisk * 100) / 100,
        expiredCount: expiredBatches.length,
        criticalCount: criticalBatches.length,
        warningCount: warningBatches.length,
        noticeCount: noticeBatches.length,
        actionSummary,
      },
      recommendations: enrichedRecommendations,
    });
  } catch (error) {
    console.error("Expiry optimizer error:", error);
    return NextResponse.json({ error: "Failed to generate expiry recommendations" }, { status: 500 });
  }
}
