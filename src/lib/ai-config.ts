// src/lib/ai-config.ts
// Phase 1: Configurable AI cost-control knobs.
//
// All four LLM routes (chat, insights, expiry-optimizer, product-assistant) read
// their max_tokens cap, max batch input, and max products input from this module.
// Values are stored in the AiConfig Prisma table and editable from the super-admin
// panel. If the DB is unreachable or a row is missing, hardcoded defaults are used
// so the AI features keep working even if the config table is dropped.

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
  },
  insights: {
    maxOutputTokens: 2048,   // covers 5-8 JSON insights + 3-5 recommendations
    maxInputBatches: null as number | null,
    maxInputProducts: null as number | null,
  },
  "expiry-optimizer": {
    maxOutputTokens: 2048,   // covers per-batch analysis for up to 50 batches
    maxInputBatches: 50,     // cap on db.batch.findMany take:
    maxInputProducts: null as number | null,
  },
  "product-assistant": {
    maxOutputTokens: 512,    // covers a single description or interaction warning
    maxInputBatches: null as number | null,
    maxInputProducts: 20,    // cap on check_interactions products array length
  },
} as const;

export type AiFeatureName = keyof typeof AI_CONFIG_DEFAULTS;

export interface AiConfigValue {
  feature: AiFeatureName;
  maxOutputTokens: number;
  maxInputBatches: number | null;
  maxInputProducts: number | null;
  updatedAt?: Date;
  updatedBy?: string | null;
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
      };
    }
    return {
      feature,
      maxOutputTokens: row.maxOutputTokens,
      maxInputBatches: row.maxInputBatches,
      maxInputProducts: row.maxInputProducts,
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
    };
  }
}

/**
 * Get all AI configs (for super-admin panel).
 * Returns the 4 known features, using defaults for any missing rows.
 */
export async function getAllAiConfigs(): Promise<AiConfigValue[]> {
  const features: AiFeatureName[] = ["chat", "insights", "expiry-optimizer", "product-assistant"];
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

  const defaults = AI_CONFIG_DEFAULTS[feature];
  const data = {
    maxOutputTokens: updates.maxOutputTokens ?? defaults.maxOutputTokens,
    maxInputBatches: updates.maxInputBatches ?? defaults.maxInputBatches,
    maxInputProducts: updates.maxInputProducts ?? defaults.maxInputProducts,
    updatedBy,
  };

  const row = await db.aiConfig.upsert({
    where: { feature },
    update: {
      ...(updates.maxOutputTokens !== undefined && { maxOutputTokens: updates.maxOutputTokens }),
      ...(updates.maxInputBatches !== undefined && { maxInputBatches: updates.maxInputBatches }),
      ...(updates.maxInputProducts !== undefined && { maxInputProducts: updates.maxInputProducts }),
      updatedBy,
    },
    create: {
      feature,
      maxOutputTokens: data.maxOutputTokens,
      maxInputBatches: data.maxInputBatches,
      maxInputProducts: data.maxInputProducts,
      updatedBy,
    },
  });

  return {
    feature,
    maxOutputTokens: row.maxOutputTokens,
    maxInputBatches: row.maxInputBatches,
    maxInputProducts: row.maxInputProducts,
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
  const features: AiFeatureName[] = ["chat", "insights", "expiry-optimizer", "product-assistant"];
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
        updatedBy,
      },
    });
  }
}
