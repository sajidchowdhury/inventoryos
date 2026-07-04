// src/lib/ai-config.ts
// Phase 1: Configurable AI cost-control knobs.
//
// All LLM routes (chat, insights, expiry-optimizer, product-assistant,
// shelf-scanner) read their max_tokens cap, max batch input, max products
// input, and (for shelf-scanner) max images input from this module. Values
// are stored in the AiConfig Prisma table and editable from the super-admin
// panel. If the DB is unreachable or a row is missing, hardcoded defaults
// are used so the AI features keep working even if the config table is
// dropped.

import { db } from "@/lib/db";

// ── Hardcoded defaults (used as fallback) ──
// These mirror the recommended values from the AI Features Report Section 5.1.
// Changing them here only changes the FALLBACK — to change live values, use the
// super-admin panel which writes to the AiConfig table.
export const AI_CONFIG_DEFAULTS = {
  chat: {
    maxOutputTokens: 1024,   // ~700-word response, enough for any single Q&A
    maxInputBatches: null as number | null,
    maxInputProducts: null as number | null,
    maxInputImages: null as number | null,
  },
  insights: {
    maxOutputTokens: 2048,   // covers 5-8 JSON insights + 3-5 recommendations
    maxInputBatches: null as number | null,
    maxInputProducts: null as number | null,
    maxInputImages: null as number | null,
  },
  "expiry-optimizer": {
    maxOutputTokens: 2048,   // covers per-batch analysis for up to 50 batches
    maxInputBatches: 50,     // cap on db.batch.findMany take:
    maxInputProducts: null as number | null,
    maxInputImages: null as number | null,
  },
  "product-assistant": {
    maxOutputTokens: 512,    // covers a single description or interaction warning
    maxInputBatches: null as number | null,
    maxInputProducts: 20,    // cap on check_interactions products array length
    maxInputImages: null as number | null,
  },
  "shelf-scanner": {
    maxOutputTokens: 8192,   // dense shelves: 40–60 topical boxes per photo
    maxInputBatches: null as number | null,
    maxInputProducts: null as number | null,
    maxInputImages: 3,
    systemPrompt: null as string | null,
    userPromptTemplate: null as string | null,
    temperature: 0.1,
    disableThinking: true,   // Gemini 2.5+ must not burn output budget on reasoning
  },
  "purchase-scan": {
    maxOutputTokens: 8192,   // invoices: 20-50 line items per photo with batch/expiry/price
    maxInputBatches: null as number | null,
    maxInputProducts: null as number | null,
    maxInputImages: 1,       // P1: one image at a time (accumulate in UI)
    systemPrompt: null as string | null,
    userPromptTemplate: null as string | null,
    temperature: 0.1,
    disableThinking: true,
  },
} as const;

export type AiFeatureName = keyof typeof AI_CONFIG_DEFAULTS;

export interface AiConfigValue {
  feature: AiFeatureName;
  maxOutputTokens: number;
  maxInputBatches: number | null;
  maxInputProducts: number | null;
  maxInputImages: number | null;
  systemPrompt?: string | null;
  userPromptTemplate?: string | null;
  temperature?: number | null;
  disableThinking?: boolean | null;
  updatedAt?: Date;
  updatedBy?: string | null;
}

export interface ShelfScannerConfig extends AiConfigValue {
  feature: "shelf-scanner";
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  temperature: number;
  disableThinking: boolean;
}

/**
 * Get the AI config for a single feature.
 * Falls back to hardcoded defaults if the DB is unreachable or the row is missing.
 * Never throws — AI routes depend on this and must not crash on config lookup.
 */
export async function getAiConfig(feature: AiFeatureName): Promise<AiConfigValue> {
  const defaults = AI_CONFIG_DEFAULTS[feature];
  try {
    const row = await db.aiConfig.findUnique({
      where: { feature },
    });
    if (!row) {
      return {
        feature,
        maxOutputTokens: defaults.maxOutputTokens,
        maxInputBatches: defaults.maxInputBatches,
        maxInputProducts: defaults.maxInputProducts,
        maxInputImages: defaults.maxInputImages,
        ...(feature === "shelf-scanner" && {
          systemPrompt: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).systemPrompt,
          userPromptTemplate: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).userPromptTemplate,
          temperature: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).temperature,
          disableThinking: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).disableThinking,
        }),
      };
    }
    return {
      feature,
      maxOutputTokens: row.maxOutputTokens,
      maxInputBatches: row.maxInputBatches,
      maxInputProducts: row.maxInputProducts,
      maxInputImages: row.maxInputImages,
      ...(feature === "shelf-scanner" && {
        systemPrompt: row.systemPrompt ?? null,
        userPromptTemplate: row.userPromptTemplate ?? null,
        temperature: row.temperature ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).temperature,
        disableThinking: row.disableThinking ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).disableThinking,
      }),
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  } catch (err) {
    console.error(`[ai-config] failed to load config for "${feature}", using defaults:`, err);
    return {
      feature,
      maxOutputTokens: defaults.maxOutputTokens,
      maxInputBatches: defaults.maxInputBatches,
      maxInputProducts: defaults.maxInputProducts,
      maxInputImages: defaults.maxInputImages,
      ...(feature === "shelf-scanner" && {
        systemPrompt: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).systemPrompt,
        userPromptTemplate: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).userPromptTemplate,
        temperature: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).temperature,
        disableThinking: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).disableThinking,
      }),
    };
  }
}

/**
 * Get all AI configs (for super-admin panel).
 * Returns the 5 known features, using defaults for any missing rows.
 */
export async function getAllAiConfigs(): Promise<AiConfigValue[]> {
  const features: AiFeatureName[] = ["chat", "insights", "expiry-optimizer", "product-assistant", "shelf-scanner"];
  const results = await Promise.all(features.map((f) => getAiConfig(f)));
  return results;
}

/**
 * Update an AI config (super-admin only).
 * Creates the row if it doesn't exist (upsert).
 * Returns the updated config.
 */
export async function updateAiConfig(
  feature: AiFeatureName,
  updates: {
    maxOutputTokens?: number;
    maxInputBatches?: number | null;
    maxInputProducts?: number | null;
    maxInputImages?: number | null;
    systemPrompt?: string | null;
    userPromptTemplate?: string | null;
    temperature?: number | null;
    disableThinking?: boolean | null;
  },
  updatedBy: string
): Promise<AiConfigValue> {
  // Validate: maxOutputTokens must be between 64 and 8192
  if (updates.maxOutputTokens !== undefined) {
    if (
      !Number.isInteger(updates.maxOutputTokens) ||
      updates.maxOutputTokens < 64 ||
      updates.maxOutputTokens > 8192
    ) {
      throw new Error("maxOutputTokens must be an integer between 64 and 8192");
    }
  }
  // Validate: maxInputBatches must be between 1 and 500 (or null)
  if (updates.maxInputBatches !== undefined && updates.maxInputBatches !== null) {
    if (
      !Number.isInteger(updates.maxInputBatches) ||
      updates.maxInputBatches < 1 ||
      updates.maxInputBatches > 500
    ) {
      throw new Error("maxInputBatches must be an integer between 1 and 500, or null");
    }
  }
  // Validate: maxInputProducts must be between 1 and 100 (or null)
  if (updates.maxInputProducts !== undefined && updates.maxInputProducts !== null) {
    if (
      !Number.isInteger(updates.maxInputProducts) ||
      updates.maxInputProducts < 1 ||
      updates.maxInputProducts > 100
    ) {
      throw new Error("maxInputProducts must be an integer between 1 and 100, or null");
    }
  }
  // Validate: maxInputImages must be between 1 and 10 (or null)
  if (updates.maxInputImages !== undefined && updates.maxInputImages !== null) {
    if (
      !Number.isInteger(updates.maxInputImages) ||
      updates.maxInputImages < 1 ||
      updates.maxInputImages > 10
    ) {
      throw new Error("maxInputImages must be an integer between 1 and 10, or null");
    }
  }
  // Shelf-scanner prompt + performance fields
  if (updates.systemPrompt !== undefined && updates.systemPrompt !== null) {
    if (updates.systemPrompt.length > 12000) {
      throw new Error("systemPrompt must be 12000 characters or fewer");
    }
  }
  if (updates.userPromptTemplate !== undefined && updates.userPromptTemplate !== null) {
    if (updates.userPromptTemplate.length > 4000) {
      throw new Error("userPromptTemplate must be 4000 characters or fewer");
    }
  }
  if (updates.temperature !== undefined && updates.temperature !== null) {
    if (updates.temperature < 0 || updates.temperature > 1) {
      throw new Error("temperature must be between 0 and 1, or null");
    }
  }

  const defaults = AI_CONFIG_DEFAULTS[feature];
  const data = {
    maxOutputTokens: updates.maxOutputTokens ?? defaults.maxOutputTokens,
    maxInputBatches: updates.maxInputBatches ?? defaults.maxInputBatches,
    maxInputProducts: updates.maxInputProducts ?? defaults.maxInputProducts,
    maxInputImages: updates.maxInputImages ?? defaults.maxInputImages,
    updatedBy,
  };

  const row = await db.aiConfig.upsert({
    where: { feature },
    update: {
      ...(updates.maxOutputTokens !== undefined && { maxOutputTokens: updates.maxOutputTokens }),
      ...(updates.maxInputBatches !== undefined && { maxInputBatches: updates.maxInputBatches }),
      ...(updates.maxInputProducts !== undefined && { maxInputProducts: updates.maxInputProducts }),
      ...(updates.maxInputImages !== undefined && { maxInputImages: updates.maxInputImages }),
      ...(updates.systemPrompt !== undefined && { systemPrompt: updates.systemPrompt }),
      ...(updates.userPromptTemplate !== undefined && { userPromptTemplate: updates.userPromptTemplate }),
      ...(updates.temperature !== undefined && { temperature: updates.temperature }),
      ...(updates.disableThinking !== undefined && { disableThinking: updates.disableThinking }),
      updatedBy,
    },
    create: {
      feature,
      maxOutputTokens: data.maxOutputTokens,
      maxInputBatches: data.maxInputBatches,
      maxInputProducts: data.maxInputProducts,
      maxInputImages: data.maxInputImages,
      ...(feature === "shelf-scanner" && {
        systemPrompt: updates.systemPrompt ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).systemPrompt,
        userPromptTemplate: updates.userPromptTemplate ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).userPromptTemplate,
        temperature: updates.temperature ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).temperature,
        disableThinking: updates.disableThinking ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).disableThinking,
      }),
      updatedBy,
    },
  });

  return {
    feature,
    maxOutputTokens: row.maxOutputTokens,
    maxInputBatches: row.maxInputBatches,
    maxInputProducts: row.maxInputProducts,
    maxInputImages: row.maxInputImages,
    ...(feature === "shelf-scanner" && {
      systemPrompt: row.systemPrompt ?? null,
      userPromptTemplate: row.userPromptTemplate ?? null,
      temperature: row.temperature ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).temperature,
      disableThinking: row.disableThinking ?? (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).disableThinking,
    }),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/**
 * Seed default config rows if they don't exist.
 * Called from the super-admin panel "Reset to defaults" button, and safe to call
 * on app startup. Idempotent.
 */
export async function seedDefaultAiConfigs(updatedBy = "system"): Promise<void> {
  const features: AiFeatureName[] = ["chat", "insights", "expiry-optimizer", "product-assistant", "shelf-scanner"];
  for (const feature of features) {
    const defaults = AI_CONFIG_DEFAULTS[feature];
    await db.aiConfig.upsert({
      where: { feature },
      update: {}, // no-op if row exists
      create: {
        feature,
        maxOutputTokens: defaults.maxOutputTokens,
        maxInputBatches: defaults.maxInputBatches,
        maxInputProducts: defaults.maxInputProducts,
        maxInputImages: defaults.maxInputImages,
        ...(feature === "shelf-scanner" && {
          systemPrompt: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).systemPrompt,
          userPromptTemplate: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).userPromptTemplate,
          temperature: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).temperature,
          disableThinking: (defaults as typeof AI_CONFIG_DEFAULTS["shelf-scanner"]).disableThinking,
        }),
        updatedBy,
      },
    });
  }
}
