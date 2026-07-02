// Shared Z.ai model names for shelf scanner (vision + OCR).

export const ZAI_VISION_MODELS = [
  "glm-ocr",
  "glm-5v-turbo",
  "glm-4.6v",
  "glm-4.6v-flash",
  "glm-4.6v-flashx",
  "glm-4.5v",
  "autoglm-phone-multilingual",
] as const;

export type ZaiVisionModel = (typeof ZAI_VISION_MODELS)[number];

/** OCR-only model — uses /layout_parsing, not /chat/completions. */
export const ZAI_OCR_MODEL = "glm-ocr" as const;

/** Text model for structuring GLM-OCR output into medicine JSON (step 2). */
export const ZAI_OCR_STRUCTURE_MODEL = "glm-4.5-flash";

/** Common admin typos → correct Z.ai model codes (error 1211 if wrong). */
const ZAI_MODEL_ALIASES: Record<string, string> = {
  "glm-ocr": "glm-ocr",
  "glm_ocr": "glm-ocr",
  "glm-4v": "glm-4.6v",
  "glm-4v-flash": "glm-4.6v-flash",
  "glm-4v-plus": "glm-4.6v",
  "glm-4.6v-flash": "glm-4.6v-flash",
  "glm-4.6v-flashx": "glm-4.6v-flashx",
  "glm-4.6v": "glm-4.6v",
  "glm-4.5v": "glm-4.5v",
  "glm-5v-turbo": "glm-5v-turbo",
};

export const ZAI_DEFAULT_VISION_MODEL = ZAI_OCR_MODEL;

export function isZaiOcrModel(model: string | null | undefined): boolean {
  return normalizeZaiVisionModel(model) === ZAI_OCR_MODEL;
}

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
    "Valid Z.ai shelf models: glm-ocr (recommended for medicine labels — OCR API), " +
    "glm-5v-turbo, glm-4.6v, glm-4.6v-flash, glm-4.6v-flashx, glm-4.5v. " +
    "Do NOT use glm-4v or glm-4v-flash — they return error 1211.";
  if (!invalidModel) return base;
  const suggestion = ZAI_MODEL_ALIASES[invalidModel.toLowerCase()];
  if (suggestion) {
    return `Model "${invalidModel}" is not valid. Did you mean "${suggestion}"? ${base}`;
  }
  return `Model "${invalidModel}" is not recognized. ${base}`;
}