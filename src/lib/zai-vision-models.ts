// Shared Z.ai vision model names + normalization for common typos.

export const ZAI_VISION_MODELS = [
  "glm-5v-turbo",
  "glm-4.6v",
  "glm-4.6v-flash",
  "glm-4.6v-flashx",
  "glm-4.5v",
  "autoglm-phone-multilingual",
] as const;

export type ZaiVisionModel = (typeof ZAI_VISION_MODELS)[number];

/** Common admin typos → correct Z.ai model codes (error 1211 if wrong). */
const ZAI_MODEL_ALIASES: Record<string, ZaiVisionModel> = {
  "glm-4v": "glm-4.6v",
  "glm-4v-flash": "glm-4.6v-flash",
  "glm-4v-plus": "glm-4.6v",
  "glm-4.6v-flash": "glm-4.6v-flash",
  "glm-4.6v-flashx": "glm-4.6v-flashx",
  "glm-4.6v": "glm-4.6v",
  "glm-4.5v": "glm-4.5v",
  "glm-5v-turbo": "glm-5v-turbo",
};

export const ZAI_DEFAULT_VISION_MODEL: ZaiVisionModel = "glm-4.6v-flash";

/**
 * Normalize a user-entered Z.ai vision model name.
 * Maps legacy/typo names (e.g. glm-4v-flash) to valid API codes (glm-4.6v-flash).
 */
export function normalizeZaiVisionModel(model: string | null | undefined): string {
  const trimmed = (model ?? "").trim();
  if (!trimmed) return ZAI_DEFAULT_VISION_MODEL;

  const lower = trimmed.toLowerCase();
  return ZAI_MODEL_ALIASES[lower] ?? trimmed;
}

export function isKnownZaiVisionModel(model: string): boolean {
  const normalized = normalizeZaiVisionModel(model);
  return (ZAI_VISION_MODELS as readonly string[]).includes(normalized);
}

export function zaiVisionModelHint(invalidModel?: string): string {
  const base =
    "Valid Z.ai vision models: glm-5v-turbo, glm-4.6v, glm-4.6v-flash (recommended), glm-4.6v-flashx, glm-4.5v. " +
    "Do NOT use glm-4v, glm-4v-flash, or glm-4v-plus — they return error 1211.";
  if (!invalidModel) return base;
  const suggestion = ZAI_MODEL_ALIASES[invalidModel.toLowerCase()];
  if (suggestion) {
    return `Model "${invalidModel}" is not valid. Did you mean "${suggestion}"? ${base}`;
  }
  return `Model "${invalidModel}" is not recognized. ${base}`;
}