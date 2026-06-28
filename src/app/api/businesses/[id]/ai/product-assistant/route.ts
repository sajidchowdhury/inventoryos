// POST /api/businesses/[id]/ai/product-assistant
// AI-powered product assistant: auto-generate descriptions, detect interactions, suggest categories
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { action, productId, productData, customerConditions } = body;

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    // ── Action: Generate product description ──
    if (action === "generate_description") {
      const product = productData || (productId
        ? await db.product.findFirst({
            where: { id: productId, businessId },
            select: { name: true, genericName: true, strength: true, dosageForm: true, manufacturer: true, scheduleType: true, isPrescription: true },
          })
        : null);

      if (!product) {
        return NextResponse.json({ error: "Product data required" }, { status: 400 });
      }

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `You are a pharmaceutical product catalog expert. Generate a concise, professional product description for a pharmacy inventory system. Include: what it treats, common uses, key warnings. Keep it under 100 words. Do not include dosing instructions.`,
          },
          {
            role: "user",
            content: `Product: ${product.name}\nGeneric: ${product.genericName || "Unknown"}\nStrength: ${product.strength || "Unknown"}\nForm: ${product.dosageForm || "Unknown"}\nManufacturer: ${product.manufacturer || "Unknown"}\nSchedule: ${product.scheduleType || "OTC"}\nPrescription required: ${product.isPrescription ? "Yes" : "No"}`,
          },
        ],
        thinking: { type: "disabled" },
      });

      return NextResponse.json({
        success: true,
        description: completion.choices[0]?.message?.content,
      });
    }

    // ── Action: Check drug interactions ──
    if (action === "check_interactions") {
      const { products, conditions } = body;

      if (!Array.isArray(products) || products.length === 0) {
        return NextResponse.json({ error: "Products array required" }, { status: 400 });
      }

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `You are a clinical pharmacist. Analyze the provided medications and patient conditions for potential drug interactions, contraindications, and safety concerns.

Return a JSON object:
{
  "riskLevel": "none" | "low" | "moderate" | "high" | "severe",
  "interactions": [
    {
      "severity": "mild" | "moderate" | "severe",
      "description": "What the interaction is",
      "recommendation": "What to do about it"
    }
  ],
  "conditionWarnings": [
    {
      "condition": "The patient condition",
      "warning": "Why this medication may be problematic",
      "recommendation": "What to suggest instead"
    }
  ],
  "generalAdvice": "Overall safety recommendation"
}

If no interactions found, return empty arrays and riskLevel "none". Be thorough but practical.`,
          },
          {
            role: "user",
            content: `Medications being dispensed:\n${JSON.stringify(products, null, 2)}\n\nPatient conditions/allergies:\n${JSON.stringify(conditions || [], null, 2)}`,
          },
        ],
        thinking: { type: "disabled" },
      });

      const response = completion.choices[0]?.message?.content;
      let result;
      try {
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { generalAdvice: response };
      } catch {
        result = { generalAdvice: response };
      }

      return NextResponse.json({
        success: true,
        interactionCheck: result,
      });
    }

    // ── Action: Suggest category ──
    if (action === "suggest_category") {
      const { productName, genericName } = body;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `You are a pharmacy categorization expert. Given a product name and generic name, suggest the most appropriate pharmacy category. Respond in JSON:
{
  "suggestedCategory": "category name",
  "suggestedType": "medicine" | "surgical" | "cosmetic" | "supplement" | "baby-care" | "other",
  "suggestedColor": "hex color code",
  "confidence": "high" | "medium" | "low",
  "reason": "why this category"
}

Common pharmacy categories: Antibiotics, Pain & Fever, Cold & Flu, Digestive Health, Diabetes, Heart & BP, Vitamins & Supplements, Skin Care, Eye & Ear, Baby Care, Surgical Items, Cosmetics & Beauty, Personal Care, First Aid, Herbal & Homeopathy, Medical Devices, Orthopedic, Respiratory.`,
          },
          {
            role: "user",
            content: `Product: ${productName || "Unknown"}\nGeneric: ${genericName || "Unknown"}`,
          },
        ],
        thinking: { type: "disabled" },
      });

      const response = completion.choices[0]?.message?.content;
      let result;
      try {
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        result = {};
      }

      return NextResponse.json({
        success: true,
        suggestion: result,
      });
    }

    // ── Action: Suggest dosage info ──
    if (action === "suggest_dosage") {
      const { genericName, strength, dosageForm } = body;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `You are a clinical pharmacist. Provide standard dosage information for the given medication. Return JSON:
{
  "adultDose": "Standard adult dosage",
  "pediatricDose": "Standard pediatric dosage (if applicable)",
  "maxDailyDose": "Maximum daily dose",
  "commonSideEffects": ["effect1", "effect2", "effect3"],
  "keyWarnings": ["warning1", "warning2"],
  "storageAdvice": "How to store"
}
Keep it concise and factual. Do not include specific brand recommendations.`,
          },
          {
            role: "user",
            content: `Generic: ${genericName || "Unknown"}\nStrength: ${strength || "Unknown"}\nForm: ${dosageForm || "Unknown"}`,
          },
        ],
        thinking: { type: "disabled" },
      });

      const response = completion.choices[0]?.message?.content;
      let result;
      try {
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        result = {};
      }

      return NextResponse.json({
        success: true,
        dosageInfo: result,
      });
    }

    return NextResponse.json({ error: "Unknown action. Use: generate_description, check_interactions, suggest_category, suggest_dosage" }, { status: 400 });
  } catch (error) {
    console.error("Product assistant error:", error);
    return NextResponse.json({ error: "Failed to process AI request" }, { status: 500 });
  }
}
