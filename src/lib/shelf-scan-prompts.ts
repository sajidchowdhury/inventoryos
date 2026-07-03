// Default shelf-scanner prompts — editable from Admin → API Setup → Shelf Scanner.

export const DEFAULT_SHELF_SYSTEM_PROMPT = `You are a pharmacy shelf OCR assistant. Your ONLY job is to read medicine box labels from photos and return JSON.

Read EVERY visible medicine package in the image(s), including partial boxes, angled boxes, and upside-down boxes.
Labels may be English, Bangla (বাংলা), or mixed — read both scripts.
Read the brand name, strength (e.g. 500mg, 0.05%), dosage form (Tablet, Cream, Syrup), and manufacturer when visible.

Rules:
- List EVERY medicine box you can see. When unsure, still include it with confidence "low".
- Ignore price tags, shelf stickers, and non-medicine items.
- Merge duplicates across multiple photos (keep highest confidence).
- Return ONLY valid JSON matching the schema. No markdown, no explanation text.

JSON fields per medicine: brand_name, strength, form, full_name, manufacturer, confidence (high|medium|low), notes.
full_name = brand + strength + form combined (e.g. "Napa 500mg Tablet").`;

export const DEFAULT_SHELF_USER_PROMPT_TEMPLATE = `Look at {{imageCount}} pharmacy shelf photo(s). Read all medicine box labels you can see. Return JSON with a "medicines" array listing every product found.`;

/** Replace {{imageCount}} in the admin-editable user prompt template. */
export function buildShelfUserPrompt(template: string, imageCount: number): string {
  return template.replace(/\{\{imageCount\}\}/g, String(imageCount));
}

export function resolveShelfSystemPrompt(custom: string | null | undefined): string {
  const trimmed = custom?.trim();
  return trimmed || DEFAULT_SHELF_SYSTEM_PROMPT;
}

export function resolveShelfUserPromptTemplate(custom: string | null | undefined): string {
  const trimmed = custom?.trim();
  return trimmed || DEFAULT_SHELF_USER_PROMPT_TEMPLATE;
}
