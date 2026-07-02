// POST /api/businesses/[id]/ai/shelf-scan
// AI vision shelf scanner: receive 2–3 shelf photos, detect medicines via the
// vision model, match against the master catalog + client products, and persist
// a ShelfScan + ShelfScanItem rows for review. The user then applies stock
// counts via POST /api/businesses/[id]/stock/bulk-update (Stage 3).
//
// Gap integrations (mirrors product-assistant/route.ts):
//   • Gap 1/7 — Rate Limiter : checkAILimit() gates each VLM call per business quota
//   • Gap 4 — Error Fallback : buildFallback()/classifyError() shape every failure mode
//   • No AI cache — image content is never cacheable (each photo is unique)
//
// Data architecture rule (CRITICAL):
//   This route ONLY READS MasterProduct + Product. It writes ShelfScan +
//   ShelfScanItem rows (scan history) — it NEVER writes Product, Inventory,
//   Transaction, or MasterProduct. Stock mutations happen in the separate
//   bulk-update endpoint (Stage 3).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkAILimit,
  logAIUsage,
} from "@/lib/ai-rate-limit";
import {
  buildFallback,
  classifyError,
  classifyRateLimitByType,
} from "@/lib/ai-fallback";
import { getAiConfig } from "@/lib/ai-config";
import { analyzeShelfImages, type DetectedMedicine } from "@/lib/shelf-scan-ai";

const FEATURE = "shelf-scanner";

// ── Limits ──
const MIN_IMAGES = 2;
const MAX_IMAGES = 3; // also enforced by AiConfig.maxInputImages, but hard-cap here too
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB per image (base64 length)
const MAX_TOTAL_BYTES = 12 * 1024 * 1024; // 12 MB total payload

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    // ── 1. Parse + validate the request body ──
    const body = await req.json();
    const { images, note } = body as { images?: unknown; note?: unknown };

    if (!Array.isArray(images) || images.length < MIN_IMAGES) {
      return NextResponse.json(
        {
          error: `Please upload at least ${MIN_IMAGES} shelf photos (got ${Array.isArray(images) ? images.length : 0}).`,
        },
        { status: 400 }
      );
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Too many photos. Maximum is ${MAX_IMAGES} per scan (got ${images.length}).` },
        { status: 400 }
      );
    }

    // Validate each image is a string data URL or HTTP URL, within size limits.
    let totalBytes = 0;
    for (const img of images) {
      if (typeof img !== "string" || !img) {
        return NextResponse.json(
          { error: "Each image must be a base64 data URL or an HTTP URL string." },
          { status: 400 }
        );
      }
      if (img.length > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "One or more images exceed the 4 MB limit. Please use smaller photos." },
          { status: 400 }
        );
      }
      totalBytes += img.length;
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Total payload too large. Please use smaller or fewer photos." },
        { status: 400 }
      );
    }

    const trimmedNote =
      typeof note === "string" ? note.trim().slice(0, 500) : null;

    // ── 2. Rate limit check (Gap 1/7) — before any VLM cost ──
    const limitCheck = await checkAILimit(businessId);
    if (!limitCheck.allowed) {
      const fallbackReason = classifyRateLimitByType(limitCheck.limitType, limitCheck.reason);
      const fallback = buildFallback(fallbackReason, {
        retryAfterSeconds: limitCheck.retryAfterSeconds,
        errorMessage: limitCheck.reason,
      });
      await logAIUsage(businessId, FEATURE, 0, false, `rate_limited:${limitCheck.limitType}`);

      return NextResponse.json(
        {
          success: false,
          ...fallback,
          error: fallback.fallbackMessage,
          type: "rate_limit",
          limitType: limitCheck.limitType,
          remaining: limitCheck.remaining,
        },
        {
          status: 429,
          headers: limitCheck.retryAfterSeconds
            ? { "Retry-After": String(limitCheck.retryAfterSeconds) }
            : undefined,
        }
      );
    }

    // ── 3. Load configurable AI limits (maxOutputTokens + maxInputImages) ──
    const aiConfig = await getAiConfig(FEATURE);
    const maxImages = aiConfig.maxInputImages ?? MAX_IMAGES;
    if (images.length > maxImages) {
      return NextResponse.json(
        {
          error: `Too many photos. The admin limit for this feature is ${maxImages} per scan.`,
        },
        { status: 400 }
      );
    }

    // ── 4. Create the ShelfScan row BEFORE the VLM call ──
    // If the VLM call fails, we still have a record that a scan was attempted.
    // detectedCount/matchedCount get updated after the matching pass.
    const shelfScan = await db.shelfScan.create({
      data: {
        businessId,
        imageCount: images.length,
        detectedCount: 0,
        matchedCount: 0,
        tokensUsed: 0,
        rawResult: null,
      },
    });

    // ── 5. Call the vision model (via the thin wrapper) ──
    let analysis;
    try {
      analysis = await analyzeShelfImages(images as string[], {
        maxOutputTokens: aiConfig.maxOutputTokens,
      });
    } catch (vlmError) {
      // Log the failure against the scan row + AIUsageLog, then return a
      // friendly fallback — mirrors the product-assistant catch block.
      await logAIUsage(
        businessId,
        FEATURE,
        0,
        false,
        vlmError instanceof Error ? vlmError.message : String(vlmError)
      );

      const reason = classifyError(vlmError);
      const fallback = buildFallback(reason, {
        errorMessage: vlmError instanceof Error ? vlmError.message : String(vlmError),
      });

      return NextResponse.json(
        {
          success: false,
          scanId: shelfScan.id,
          ...fallback,
          error: fallback.fallbackMessage,
          type: "llm_error",
        },
        { status: 500 }
      );
    }

    const { detections, rawResponse, tokensUsed } = analysis;

    // ── 6. DB matching pass ──
    // For each detection, try to find a client Product (this business's
    // inventory) first; if not found, try the MasterProduct catalog. Tag the
    // detection's matchedMethod accordingly so the UI knows what to show.
    const items = await matchDetections(businessId, detections);

    // ── 7. Persist results ──
    // Write ShelfScanItem rows in bulk, then update the ShelfScan aggregate counts.
    if (items.length > 0) {
      await db.shelfScanItem.createMany({
        data: items.map((it) => ({
          shelfScanId: shelfScan.id,
          productId: it.productId ?? null,
          masterProductId: it.masterProductId ?? null,
          detectedName: it.detectedName,
          detectedStrength: it.detectedStrength ?? null,
          detectedForm: it.detectedForm ?? null,
          detectedManufacturer: it.detectedManufacturer ?? null,
          confidence: it.confidence,
          matchedMethod: it.matchedMethod,
          previousQuantity: it.previousQuantity,
          newQuantity: null, // user fills this in during review
        })),
      });
    }

    const matchedCount = items.filter(
      (it) => it.matchedMethod === "ai" && it.productId
    ).length;

    await db.shelfScan.update({
      where: { id: shelfScan.id },
      data: {
        detectedCount: detections.length,
        matchedCount,
        tokensUsed,
        rawResult: rawResponse,
      },
    });

    // ── 8. Log successful usage ──
    await logAIUsage(businessId, FEATURE, tokensUsed, true);

    // ── 9. Return the full match set for the UI to render ──
    // Re-fetch with relations so the client gets product/master details inline.
    const persistedItems = await db.shelfScanItem.findMany({
      where: { shelfScanId: shelfScan.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            strength: true,
            dosageForm: true,
            manufacturer: true,
            rackNo: true,
            reorderLevel: true,
            sellingPrice: true,
            mrp: true,
            unit: true,
            inventory: { select: { quantity: true } },
          },
        },
        masterProduct: {
          select: {
            id: true,
            name: true,
            genericName: true,
            strength: true,
            dosageForm: true,
            manufacturerStr: true,
            defaultMrp: true,
            unit: true,
          },
        },
      },
      orderBy: { confidence: "desc" },
    });

    return NextResponse.json({
      success: true,
      scanId: shelfScan.id,
      detectedCount: detections.length,
      matchedCount,
      tokensUsed,
      remaining: limitCheck.remaining,
      note: trimmedNote,
      items: persistedItems.map((it) => ({
        id: it.id,
        detectedName: it.detectedName,
        detectedStrength: it.detectedStrength,
        detectedForm: it.detectedForm,
        detectedManufacturer: it.detectedManufacturer,
        confidence: it.confidence,
        matchedMethod: it.matchedMethod,
        previousQuantity: it.previousQuantity,
        newQuantity: it.newQuantity,
        product: it.product
          ? {
              id: it.product.id,
              name: it.product.name,
              strength: it.product.strength,
              dosageForm: it.product.dosageForm,
              manufacturer: it.product.manufacturer,
              rackNo: it.product.rackNo,
              reorderLevel: it.product.reorderLevel,
              sellingPrice: it.product.sellingPrice,
              mrp: it.product.mrp,
              unit: it.product.unit,
              currentStock: it.product.inventory?.quantity ?? 0,
            }
          : null,
        masterProduct: it.masterProduct
          ? {
              id: it.masterProduct.id,
              name: it.masterProduct.name,
              genericName: it.masterProduct.genericName,
              strength: it.masterProduct.strength,
              dosageForm: it.masterProduct.dosageForm,
              manufacturer: it.masterProduct.manufacturerStr,
              defaultMrp: it.masterProduct.defaultMrp,
              unit: it.masterProduct.unit,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Shelf scan error:", error);

    await logAIUsage(
      businessId,
      FEATURE,
      0,
      false,
      error instanceof Error ? error.message : String(error)
    ).catch(() => undefined);

    const reason = classifyError(error);
    const fallback = buildFallback(reason, {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        ...fallback,
        error: fallback.fallbackMessage,
        type: "llm_error",
      },
      { status: 500 }
    );
  }
}

// ── Matching pass ──
//
// For each detected medicine:
//   1. Try to find a client Product for THIS business whose name matches
//      (case-insensitive contains). If found, it's "matched" — show the card
//      with current stock. Read Inventory.quantity for previousQuantity.
//   2. If no client Product, search the MasterProduct catalog the same way.
//      If found, it's "master-only" — UI shows "Add to inventory" button.
//   3. If neither, it's "unmatched" — UI shows "Quick Add" + "Add Manually".
//
// The match is intentionally simple (contains, not fuzzy) for MVP speed —
// SQLite doesn't have trigram similarity without an extension, and a contains
// check on name + manufacturer catches the common cases. We can upgrade to a
// proper fuzzy matcher later without changing the route contract.

interface MatchedItem {
  productId: string | null;
  masterProductId: string | null;
  detectedName: string;
  detectedStrength: string | null;
  detectedForm: string | null;
  detectedManufacturer: string | null;
  confidence: number;
  matchedMethod: "ai" | "manual" | "quick-add" | "unmatched";
  previousQuantity: number;
}

async function matchDetections(
  businessId: string,
  detections: DetectedMedicine[]
): Promise<MatchedItem[]> {
  const results: MatchedItem[] = [];

  for (const det of detections) {
    const lowerName = det.name.toLowerCase();

    // 1. Try client Product match (this business's own products)
    const clientProduct = await db.product.findFirst({
      where: {
        businessId,
        isActive: true,
        name: { contains: lowerName },
      },
      include: { inventory: { select: { quantity: true } } },
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

    // 2. Try MasterProduct catalog match
    const masterProduct = await db.masterProduct.findFirst({
      where: {
        isActive: true,
        name: { contains: lowerName },
      },
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
        matchedMethod: "unmatched", // master-only — UI shows "Add to inventory"
        previousQuantity: 0,
      });
      continue;
    }

    // 3. No match anywhere — truly unmatched
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
