// Matching pass for shelf-scan detections:
//   1. Client Product (this pharmacy's inventory) → matchedMethod "ai"
//   2. MasterProduct catalog → matchedMethod "master-catalog"
//   3. Neither → matchedMethod "unmatched" (brand-new; user quick-adds)

import { db } from "@/lib/db";
import type { DetectedMedicine } from "@/lib/shelf-scan-ai";

export type ShelfMatchMethod =
  | "ai"
  | "master-catalog"
  | "manual"
  | "quick-add"
  | "unmatched";

export interface MatchedShelfItem {
  productId: string | null;
  masterProductId: string | null;
  detectedName: string;
  detectedStrength: string | null;
  detectedForm: string | null;
  detectedManufacturer: string | null;
  confidence: number;
  matchedMethod: ShelfMatchMethod;
  previousQuantity: number;
}

function nameSearchOr(name: string) {
  // Case-insensitive search on product name and generic name (restored in Phase 2A).
  return [
    { name: { contains: name, mode: "insensitive" as const } },
    { genericName: { contains: name, mode: "insensitive" as const } },
  ];
}

export async function matchDetections(
  businessId: string,
  detections: DetectedMedicine[]
): Promise<MatchedShelfItem[]> {
  const results: MatchedShelfItem[] = [];

  for (const det of detections) {
    const trimmedName = det.name.trim();
    if (!trimmedName) continue;

    // 1. Client inventory — prefer exact-ish name match for this business
    const clientProduct = await db.product.findFirst({
      where: {
        businessId,
        isActive: true,
        OR: nameSearchOr(trimmedName),
      },
      include: { inventory: { select: { quantity: true } } },
      orderBy: { name: "asc" },
    });

    if (clientProduct) {
      results.push({
        productId: clientProduct.id,
        masterProductId: clientProduct.masterProductId ?? null,
        detectedName: det.name,
        detectedStrength: det.strength ?? null,
        detectedForm: det.dosageForm ?? null,
        detectedManufacturer: det.manufacturer ?? null,
        confidence: det.confidence,
        matchedMethod: "ai",
        previousQuantity: clientProduct.inventory?.quantity ?? 0,
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
    });

    if (masterProduct) {
      results.push({
        productId: null,
        masterProductId: masterProduct.id,
        detectedName: det.name,
        detectedStrength: det.strength ?? null,
        detectedForm: det.dosageForm ?? null,
        detectedManufacturer: det.manufacturer ?? null,
        confidence: det.confidence,
        matchedMethod: "master-catalog",
        previousQuantity: 0,
      });
      continue;
    }

    // 3. Brand new — not in client list or master catalog
    results.push({
      productId: null,
      masterProductId: null,
      detectedName: det.name,
      detectedStrength: det.strength ?? null,
      detectedForm: det.dosageForm ?? null,
      detectedManufacturer: det.manufacturer ?? null,
      confidence: det.confidence,
      matchedMethod: "unmatched",
      previousQuantity: 0,
    });
  }

  return results;
}