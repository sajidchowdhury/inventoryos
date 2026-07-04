// Parses purchase-scan vision-model output into DetectedInvoiceItem[].
// Handles strict JSON, broken JSON, markdown fences, and plain-text lists.
// Mirrors shelf-scan-parse.ts patterns but adapted for invoice line items
// (which have qty + batch + expiry + price fields, not shelf count fields).

export interface DetectedInvoiceItem {
  productName: string;
  genericName: string | null;
  quantity: number | null;
  unit: string | null;
  batchNo: string | null;
  expiryDate: string | null;  // YYYY-MM-DD
  mfgDate: string | null;     // YYYY-MM-DD
  mrp: number | null;
  unitCost: number | null;
  confidence: number;
}

export interface PurchaseParseDiagnostic {
  parseFailed: boolean;
  modelReturnedEmpty: boolean;
  rawItemCount: number;
  arrayKeyUsed: string | null;
  parseMethod: "json" | "regex" | "plaintext" | "none";
  rawPreview: string | null;
  message: string;
}

export interface PurchaseParseResult {
  detections: DetectedInvoiceItem[];
  diagnostic: PurchaseParseDiagnostic;
}

const ITEM_ARRAY_KEYS = [
  "items",
  "line_items",
  "lineItems",
  "products",
  "medicines",
  "detections",
  "results",
] as const;

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number" && !isNaN(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "high") return 0.9;
    if (v === "medium") return 0.65;
    if (v === "low") return 0.4;
    const num = parseFloat(v);
    if (!isNaN(num)) return Math.max(0, Math.min(1, num));
  }
  return 0.5;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const num = parseFloat(cleaned);
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;

  // Already ISO format YYYY-MM-DD
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // DD/MM/YYYY → YYYY-MM-DD
  const dmyMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // MM/YYYY → YYYY-MM-01 (only month/year shown)
  const myMatch = v.match(/^(\d{1,2})\/(\d{4})/);
  if (myMatch) {
    const [, mm, yyyy] = myMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-01`;
  }

  // YYYY-MM (already partial ISO)
  const ymMatch = v.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const [, yyyy, mm] = ymMatch;
    return `${yyyy}-${mm}-01`;
  }

  return null;
}

function itemToDetection(obj: Record<string, unknown>): DetectedInvoiceItem | null {
  const productName = pickString(obj, [
    "productName",
    "product_name",
    "name",
    "brand_name",
    "brandName",
    "brand",
    "medicine_name",
    "medicineName",
    "title",
    "label",
  ]);
  if (!productName) return null;

  const genericName = pickString(obj, ["genericName", "generic_name", "generic", "ingredient"]) || null;

  const quantity = pickNumber(obj, ["quantity", "qty", "count", "units"]);
  const mrp = pickNumber(obj, ["mrp", "MRP", "maxRetailPrice", "max_retail_price", "retailPrice"]);
  const unitCost = pickNumber(obj, [
    "unitCost",
    "unit_cost",
    "cost",
    "rate",
    "price",
    "purchasePrice",
    "purchase_price",
  ]);

  const unit = pickString(obj, ["unit", "pack", "packUnit", "pack_unit"]) || null;
  const batchNo = pickString(obj, ["batchNo", "batch_no", "batch", "batchNumber", "batch_number"]) || null;
  const expiryDate = normalizeDate(obj["expiryDate"] ?? obj["expiry_date"] ?? obj["expiry"] ?? obj["exp"]);
  const mfgDate = normalizeDate(obj["mfgDate"] ?? obj["mfg_date"] ?? obj["mfg"] ?? obj["manufacturingDate"]);

  return {
    productName,
    genericName,
    quantity,
    unit,
    batchNo,
    expiryDate,
    mfgDate,
    mrp,
    unitCost,
    confidence: normalizeConfidence(obj["confidence"]),
  };
}

function tryParseJson(raw: string): { items: Record<string, unknown>[]; arrayKey: string | null } | null {
  // Try strict JSON first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { items: parsed as Record<string, unknown>[], arrayKey: null };
    }
    if (parsed && typeof parsed === "object") {
      for (const key of ITEM_ARRAY_KEYS) {
        if (Array.isArray((parsed as Record<string, unknown>)[key])) {
          return {
            items: (parsed as Record<string, unknown>[])[key] as Record<string, unknown>[],
            arrayKey: key,
          };
        }
      }
      // Single object that looks like an item
      if ((parsed as Record<string, unknown>).productName || (parsed as Record<string, unknown>).name) {
        return { items: [parsed as Record<string, unknown>], arrayKey: null };
      }
    }
  } catch {
    // fall through to regex extraction
  }

  // Try to extract a JSON array or object from markdown fences / surrounding text
  const jsonBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return tryParseJson(jsonBlockMatch[1]);
  }

  // Try to find the first { ... } or [ ... ] block
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return tryParseJson(objMatch[0]);
    } catch {
      // fall through
    }
  }

  return null;
}

function tryParsePlainText(raw: string): DetectedInvoiceItem[] {
  // Last-resort: parse comma-separated or line-by-line text.
  // Expected format from retry prompt: "product name, qty, batch, expiry, mrp, unit cost"
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const detections: DetectedInvoiceItem[] = [];

  for (const line of lines) {
    // Skip lines that look like headers or totals
    if (/^(total|subtotal|discount|vat|amount|signature|name|product)/i.test(line)) continue;

    const parts = line.split(/[,|\t]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    // Heuristic: first part is product name, try to find numbers for qty/price
    const productName = parts[0];
    if (!productName || productName.length < 2) continue;

    const numbers = parts
      .map((p) => {
        const n = parseFloat(p.replace(/[^0-9.]/g, ""));
        return isNaN(n) ? null : n;
      })
      .filter((n): n is number => n !== null);

    const dateStr = parts.find((p) => /\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{4}[/\-]\d{2}/.test(p));

    detections.push({
      productName,
      genericName: null,
      quantity: numbers[0] ?? null,
      unit: null,
      batchNo: null,
      expiryDate: dateStr ? normalizeDate(dateStr) : null,
      mfgDate: null,
      mrp: numbers.length > 1 ? numbers[numbers.length - 1] : null,
      unitCost: numbers.length > 1 ? numbers[numbers.length - 2] ?? null : null,
      confidence: 0.3, // low confidence for plaintext parse
    });
  }

  return detections;
}

export function parsePurchaseScanResponse(raw: string): PurchaseParseResult {
  const trimmed = raw?.trim() ?? "";
  const rawPreview = trimmed.substring(0, 300);

  if (!trimmed) {
    return {
      detections: [],
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: true,
        rawItemCount: 0,
        arrayKeyUsed: null,
        parseMethod: "none",
        rawPreview,
        message: "Model returned empty response",
      },
    };
  }

  // ── Try JSON parse ──
  const jsonResult = tryParseJson(trimmed);
  if (jsonResult && jsonResult.items.length > 0) {
    const detections = jsonResult.items
      .map(itemToDetection)
      .filter((d): d is DetectedInvoiceItem => d !== null);

    return {
      detections,
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: detections.length === 0,
        rawItemCount: jsonResult.items.length,
        arrayKeyUsed: jsonResult.arrayKey,
        parseMethod: "json",
        rawPreview,
        message: `Parsed ${detections.length} item(s) from JSON (key: ${jsonResult.arrayKey || "array"})`,
      },
    };
  }

  // ── Try plaintext parse ──
  const plaintextDetections = tryParsePlainText(trimmed);
  if (plaintextDetections.length > 0) {
    return {
      detections: plaintextDetections,
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: false,
        rawItemCount: plaintextDetections.length,
        arrayKeyUsed: null,
        parseMethod: "plaintext",
        rawPreview,
        message: `Parsed ${plaintextDetections.length} item(s) from plaintext (low confidence)`,
      },
    };
  }

  // ── Failed to parse anything ──
  return {
    detections: [],
    diagnostic: {
      parseFailed: true,
      modelReturnedEmpty: false,
      rawItemCount: 0,
      arrayKeyUsed: null,
      parseMethod: "none",
      rawPreview,
      message: "Could not parse any items from response (JSON and plaintext both failed)",
    },
  };
}
