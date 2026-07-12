// Matching pass for purchase-scan detections:
//   1. Client Product (this pharmacy's inventory) → matchedMethod "ai"
//   2. MasterProduct catalog → matchedMethod "master-catalog"
//   3. Neither → matchedMethod "unmatched" (user links manually in P3)
//
// Mirrors shelf-scan-match.ts but adapted for invoice items (which carry
// qty + batch + expiry + price, not shelf count fields).

import { db } from "@/lib/db";
import type { DetectedInvoiceItem } from "@/lib/purchase-scan-ai";

export type PurchaseMatchMethod =
  | "ai"              // matched to client Product
  | "master-catalog"  // matched to MasterProduct only
  | "unmatched";      // no match — user links manually in P3

export interface MatchedPurchaseItem {
  // Match result
  productId: string | null;
  masterProductId: string | null;
  matchedMethod: PurchaseMatchMethod;
  matchedName: string | null;  // the product name from the catalog (for display)
  // Detected fields (carried through for the cart)
  detectedProductName: string;
  detectedGenericName: string | null;
  detectedQuantity: number | null;
  detectedUnit: string | null;
  detectedBatchNo: string | null;
  detectedExpiryDate: string | null;
  detectedMfgDate: string | null;
  detectedMrp: number | null;
  detectedUnitCost: number | null;
  confidence: number;
  // Confidence classification for P3 review UX
  confidenceLevel: "high" | "medium" | "low";
}

function nameSearchOr(name: string) {
  // Case-insensitive search on product name and generic name (restored in Phase 2A).
  return [
    { name: { contains: name, mode: "insensitive" as const } },
    { genericName: { contains: name, mode: "insensitive" as const } },
  ];
}

function classifyConfidence(score: number, matchedMethod: PurchaseMatchMethod): "high" | "medium" | "low" {
  // Unmatched items are always "low" for review purposes (user must link them)
  if (matchedMethod === "unmatched") return "low";
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export async function matchPurchaseDetections(
  businessId: string,
  detections: DetectedInvoiceItem[]
): Promise<MatchedPurchaseItem[]> {
  const results: MatchedPurchaseItem[] = [];

  for (const det of detections) {
    const trimmedName = det.productName.trim();
    if (!trimmedName) continue;

    // 1. Client inventory — prefer exact-ish name match for this business
    const clientProduct = await db.product.findFirst({
      where: {
        businessId,
        isActive: true,
        OR: nameSearchOr(trimmedName),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        genericName: true,
        unit: true,
        masterProductId: true,
      },
    });

    if (clientProduct) {
      results.push({
        productId: clientProduct.id,
        masterProductId: clientProduct.masterProductId ?? null,
        matchedMethod: "ai",
        matchedName: clientProduct.name,
        detectedProductName: det.productName,
        detectedGenericName: det.genericName,
        detectedQuantity: det.quantity,
        detectedUnit: det.unit,
        detectedBatchNo: det.batchNo,
        detectedExpiryDate: det.expiryDate,
        detectedMfgDate: det.mfgDate,
        detectedMrp: det.mrp,
        detectedUnitCost: det.unitCost,
        confidence: det.confidence,
        confidenceLevel: classifyConfidence(det.confidence, "ai"),
      });
      continue;
    }

    // 2. Master catalog — found nationally but not in this pharmacy yet
    const masterProduct = await db.masterProduct.findFirst({
      where: {
        isActive: true,
        OR: nameSearchOr(trimmedName),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    if (masterProduct) {
      results.push({
        productId: null,
        masterProductId: masterProduct.id,
        matchedMethod: "master-catalog",
        matchedName: masterProduct.name,
        detectedProductName: det.productName,
        detectedGenericName: det.genericName,
        detectedQuantity: det.quantity,
        detectedUnit: det.unit,
        detectedBatchNo: det.batchNo,
        detectedExpiryDate: det.expiryDate,
        detectedMfgDate: det.mfgDate,
        detectedMrp: det.mrp,
        detectedUnitCost: det.unitCost,
        confidence: det.confidence,
        confidenceLevel: classifyConfidence(det.confidence, "master-catalog"),
      });
      continue;
    }

    // 3. Brand new — not in client list or master catalog
    results.push({
      productId: null,
      masterProductId: null,
      matchedMethod: "unmatched",
      matchedName: null,
      detectedProductName: det.productName,
      detectedGenericName: det.genericName,
      detectedQuantity: det.quantity,
      detectedUnit: det.unit,
      detectedBatchNo: det.batchNo,
      detectedExpiryDate: det.expiryDate,
      detectedMfgDate: det.mfgDate,
      detectedMrp: det.mrp,
      detectedUnitCost: det.unitCost,
      confidence: det.confidence,
      confidenceLevel: classifyConfidence(det.confidence, "unmatched"),
    });
  }

  return results;
}
