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
          strength: { type: "STRING" },
          form: { type: "STRING" },
          full_name: { type: "STRING" },
          manufacturer: { type: "STRING" },
          confidence: { type: "STRING" },
          notes: { type: "STRING" },
        },
        required: ["brand_name", "full_name"],
      },
    },
  },
  required: ["medicines"],
} as const;
