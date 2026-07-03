// Gemini responseSchema for shelf scanner — forces valid JSON shape.

export const GEMINI_SHELF_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    total_medicines_detected: { type: "INTEGER" },
    medicines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          brand_name: { type: "STRING" },
          strength: { type: "STRING", nullable: true },
          form: { type: "STRING", nullable: true },
          full_name: { type: "STRING" },
          manufacturer: { type: "STRING", nullable: true },
          confidence: { type: "STRING" },
          notes: { type: "STRING", nullable: true },
        },
        required: ["brand_name", "full_name", "confidence"],
      },
    },
  },
  required: ["total_medicines_detected", "medicines"],
} as const;
