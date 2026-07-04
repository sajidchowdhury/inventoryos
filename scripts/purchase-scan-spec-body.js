// Purchase Sheet Scanner Plan — Body builder
// Produces an array of Paragraph/Table elements for the body section.

const H = require("/home/z/my-project/inventoryos/scripts/ai-report-helpers");
const {
  P, c, NB, noBorders, allNoBorders, tableBorders,
  safeText, bodyPara, bodyParaRich, tr, h1, h2, h3,
  calloutPara, bulletItem, tableCaption, figureCaption,
  tcell, tcellRich, makeTable, spacer, imageBlock,
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType, TableLayoutType,
} = H;

function phaseOverviewTable() {
  return makeTable(
    ["Phase", "Theme", "Features", "Effort", "Status"],
    [
      [{ text: "P1", bold: true, fill: P.surface }, "Vision Scan API", "Scan endpoint + invoice prompt + catalog matching", "1 session", "Pending"],
      [{ text: "P2", bold: true, fill: P.surface }, "Scanner UI", "Scan button + image upload + accumulate into cart", "1 session", "Pending"],
      [{ text: "P3", bold: true, fill: P.surface }, "Review & Edit", "Edit detected items + link unmatched + confidence", "1 session", "Pending"],
      [{ text: "P4", bold: true, fill: P.surface }, "Polish & Edge Cases", "Help text + manual fallback + SuperAdmin docs", "1 session", "Pending"],
    ],
    [10, 25, 45, 12, 10]
  );
}

function featureCard(label, title, color) {
  return new Paragraph({
    spacing: { before: 160, after: 80, line: 312 },
    indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: c(color || P.accent), space: 12 } },
    children: [
      new TextRun({
        text: label.toUpperCase(),
        size: 16, bold: true, color: c(color || P.accent),
        font: { ascii: "Calibri" }, characterSpacing: 30,
      }),
      new TextRun({ text: "  \u2014  ", size: 18, color: c(P.secondary) }),
      new TextRun({
        text: title,
        size: 22, bold: true, color: c(P.primary),
        font: { ascii: "Calibri" },
      }),
    ],
  });
}

function acceptanceCriteria(items) {
  return items.map((item) => new Paragraph({
    spacing: { line: 312, before: 0, after: 80 },
    indent: { left: 360, hanging: 240 },
    children: [
      new TextRun({ text: "\u2610  ", size: 22, color: c(P.accent), bold: true }),
      new TextRun({ text: item, size: 22, color: c(P.body), font: { ascii: "Calibri" } }),
    ],
  }));
}

function buildBody() {
  const out = [];

  // ── Table of Contents ──
  out.push(new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "Table of Contents", size: 32, bold: true, color: c(P.primary), font: { ascii: "Calibri" } })],
  }));
  out.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }));
  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("1. Executive Summary"));

  out.push(bodyPara(
    "Today, recording a purchase in InventoryOS requires the pharmacist to search for each product one at a time and manually enter quantity, batch number, expiry date, and price. A typical supplier invoice has 20\u201350 line items, so this process takes 15\u201330 minutes per purchase \u2014 a significant friction point that discourages real-time purchase recording and leads to backlogs."
  ));

  out.push(bodyPara(
    "This document specifies a phased plan to add an AI vision scanner to the purchase flow. The pharmacist photographs the supplier invoice (one page at a time), the system detects line items (product name, quantity, batch, expiry, MRP, unit cost), matches them against the product catalog, and adds them to the purchase cart. The user reviews, edits any mistakes, and saves \u2014 turning a 30-minute task into a 5-minute one."
  ));

  out.push(h3("Key design decision: one image at a time"));
  out.push(bodyPara(
    "The founder asked whether to support multi-image batch upload or one-image-at-a-time repeated scanning. This plan adopts the one-at-a-time approach because it matches the proven shelf scanner pattern, gives immediate feedback (each page's items appear instantly), avoids timeout risks from large batch payloads, allows easy retry of failed pages, and lets the user photograph and upload pages interleaved rather than all upfront. The only cost is one extra tap per page \u2014 negligible against the ~10\u201315 second scan time per image."
  ));

  out.push(h3("What this plan delivers"));
  out.push(bulletItem("A new POST /api/businesses/[id]/ai/purchase-scan endpoint that accepts one invoice photo and returns detected line items (P1)."));
  out.push(bulletItem("Catalog matching: each detected item is matched to an existing Product by name or generic; unmatched items are flagged for manual linking (P1)."));
  out.push(bulletItem("A \u201cScan purchase sheet\u201d button beside the existing search input in PurchaseForm (P2)."));
  out.push(bulletItem("Accumulating scan results: each scanned page's items are added to a running list; user scans multiple pages to build the full purchase (P2)."));
  out.push(bulletItem("Items flow into the existing purchase cart with detected qty/batch/expiry/mrp pre-filled \u2014 user reviews and edits before saving (P2)."));
  out.push(bulletItem("Edit screen for scanned items: fix quantities, correct batch numbers, link unmatched items to existing products or create new ones (P3)."));
  out.push(bulletItem("Confidence indicators: low-confidence detections are visually flagged so the user knows to double-check (P3)."));
  out.push(bulletItem("Help text, manual fallback, and super-admin documentation (P4)."));

  out.push(h3("Phase overview"));
  out.push(tableCaption("Table 1: Phase overview \u2014 themes, features, effort, and tracking status"));
  out.push(phaseOverviewTable());
  out.push(spacer(240));

  out.push(calloutPara(
    "Tracking: After this spec is approved, a new \u00a717 is added to PROJECT_CONTEXT.md. Each phase gets a status row updated as work completes. The worklog.md receives one entry per phase using the Task ID pattern purchase-scan-p1 through purchase-scan-p4.",
    P.aiAccent
  ));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 2. CURRENT STATE & GAP ANALYSIS
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("2. Current State & Gap Analysis"));

  out.push(h2("2.1 How purchases work today"));
  out.push(bodyPara(
    "The purchase flow lives at src/modules/pharmacy/components/PurchaseForm.tsx (438 lines). The user selects a supplier, then searches for products one at a time via a debounced search input that hits GET /api/businesses/[id]/products?search=. Tapping a product adds it to a cart with empty fields for quantity, batch number, expiry date, MRP, and unit cost. The user fills these in manually for every line item, then submits via POST /api/businesses/[id]/purchases."
  ));
  out.push(bodyPara(
    "The existing shelf scanner (src/modules/pharmacy/components/ShelfScanner.tsx, 1250 lines) already implements a proven one-image-at-a-time AI vision flow with image compression, base64 encoding, vision model invocation, and structured JSON parsing. The purchase scanner will reuse this infrastructure \u2014 the only differences are the prompt (invoice line items vs shelf stock detection) and the output handling (add to purchase cart vs update stock counts)."
  ));

  out.push(h2("2.2 The gap"));
  out.push(bodyPara(
    "There is no way to scan a supplier invoice. Every purchase requires manual line-by-line entry. For a pharmacy receiving 3\u20135 supplier deliveries per week with 20\u201350 items each, this is 60\u2013250 manual entries per week \u2014 a major time sink that often results in delayed purchase recording, which in turn makes the inventory and expiry data stale."
  ));

  out.push(h2("2.3 Why one-at-a-time (not batch)"));
  out.push(tableCaption("Table 2: Multi-image batch vs one-at-a-time comparison"));
  out.push(makeTable(
    ["Factor", "One-at-a-time (chosen)", "Multi-image batch"],
    [
      ["Proven pattern", { text: "Matches existing shelf scanner", color: P.accent, bold: true }, "New pattern to build"],
      ["Feedback speed", { text: "Each page appears instantly", color: P.accent, bold: true }, "Wait for all scans"],
      ["Timeout risk", { text: "~3-5MB per request (safe)", color: P.accent, bold: true }, "~20-50MB batch (Next.js limits)"],
      ["Retry on failure", { text: "Retry just the failed page", color: P.accent, bold: true }, "Re-upload everything"],
      ["Workflow", { text: "Photo \u2192 scan \u2192 results \u2192 photo", color: P.accent, bold: true }, "Photo all pages first"],
      ["Cart building", { text: "Grows progressively", color: P.accent, bold: true }, "All items at end"],
      ["UI complexity", { text: "Single file input", color: P.accent, bold: true }, "Multi-select + batch progress"],
    ],
    [20, 40, 40]
  ));
  out.push(spacer(200));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 3. PHASE 1 — VISION SCAN API + CATALOG MATCHING
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("3. Phase 1 \u2014 Vision Scan API + Catalog Matching"));

  out.push(h2("3.1 Rationale"));
  out.push(bodyPara(
    "Phase 1 builds the backend: a new API endpoint that accepts one invoice photo, calls the vision model with an invoice-optimized prompt, parses the detected line items, and matches each item to the business's product catalog. The endpoint returns structured JSON \u2014 it does NOT write to the Purchase or Product tables (the user reviews and submits via the existing purchase endpoint). This separation matches the shelf scanner's data architecture rule: scan endpoints only read, never write stock."
  ));

  out.push(h2("3.2 Scope"));

  out.push(featureCard("Feature 1.1", "POST /api/businesses/[id]/ai/purchase-scan endpoint", P.accent));
  out.push(bodyPara(
    "Accepts one base64-encoded image (max 6MB, same limit as shelf scanner). Validates via checkAILimit() (rate limit + tier gate + kill switch). Calls the vision model via the existing vision-provider.ts abstraction. The prompt is tuned for supplier invoices: 'Extract each line item from this medicine purchase invoice. For each item return: productName, genericName (if visible), quantity (number), unit, batchNo, expiryDate (YYYY-MM-DD), mfgDate (if visible), mrp (number), unitCost (number). Return JSON array.' Returns the parsed items + matching results."
  ));

  out.push(featureCard("Feature 1.2", "Invoice-optimized vision prompt", P.aiAccent));
  out.push(bodyPara(
    "New file src/lib/purchase-scan-prompts.ts (mirrors shelf-scan-prompts.ts). The prompt is editable from the super-admin panel (like the shelf scanner prompts). Key differences from shelf scanner prompt: (a) asks for invoice line items not shelf stock, (b) extracts batch + expiry + price fields, (c) handles tabular invoice layouts with columns, (d) tolerates multi-page invoices (each photo is one page). Includes a 'salvage' parser that handles broken JSON responses (reuses shelf-scan-parse.ts patterns)."
  ));

  out.push(featureCard("Feature 1.3", "Catalog matching for detected items", P.accent));
  out.push(bodyPara(
    "For each detected item, the endpoint matches against the business's Product table by name (exact, then fuzzy via case-insensitive contains), then by genericName. If a match is found, returns { matched: true, productId, matchedName }. If no match, returns { matched: false, detectedName, suggestion: 'create' or 'link' }. The user decides in the UI (P3). Reuses matchDetections() patterns from shelf-scan-match.ts but adapted for invoice items (which have qty + batch + price, not shelf count)."
  ));

  out.push(h2("3.3 Schema changes"));
  out.push(bodyPara(
    "New model PurchaseScan (audit trail, mirrors ShelfScan): id, businessId, imageHash, detectedItems (Json), matchedCount, unmatchedCount, createdAt. Optional \u2014 the scan can be stateless (return results without persisting). This plan recommends persisting for audit + debugging, but it's not required for the feature to work."
  ));
  out.push(tableCaption("Table 3: P1 Prisma schema additions (optional audit table)"));
  out.push(makeTable(
    ["Model", "Fields", "Purpose"],
    [
      ["PurchaseScan (NEW, optional)", "id, businessId, imageHash, detectedItems (Json), matchedCount, unmatchedCount, createdAt", "Audit trail of scans for debugging + usage analytics"],
    ],
    [30, 45, 25]
  ));
  out.push(spacer(160));

  out.push(h2("3.4 API changes"));
  out.push(tableCaption("Table 4: P1 API changes"));
  out.push(makeTable(
    ["Route", "Method", "Purpose"],
    [
      ["/api/businesses/[id]/ai/purchase-scan", "POST", "Accept 1 image, return detected + matched line items"],
      ["(existing) /api/businesses/[id]/purchases", "POST", "Unchanged \u2014 still receives the cart, now with scanned items pre-filled"],
    ],
    [45, 10, 45]
  ));
  out.push(spacer(160));

  out.push(h2("3.5 AI defense stack integration"));
  out.push(bodyPara(
    "The new endpoint integrates with the existing 9-tier AI defense stack: checkAILimit() (rate limit + tier + kill switch + circuit breaker), logAIUsage() (success/failure tracking), buildFallback() (bilingual error messages). Feature name: 'purchase-scan'. Rate limit counts against the business's daily/monthly AI quota. No caching (image content is never cacheable)."
  ));

  out.push(h2("3.6 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "POST /api/businesses/[id]/ai/purchase-scan accepts 1 base64 image and returns JSON",
    "Response includes detectedItems array with: productName, genericName, quantity, unit, batchNo, expiryDate, mrp, unitCost",
    "Each item includes a 'matched' boolean + productId (if matched) or 'suggestion' (if unmatched)",
    "Endpoint enforces AI rate limits (checkAILimit) + logs usage (logAIUsage)",
    "Endpoint returns bilingual fallback on vision model failure (buildFallback)",
    "Image size limit: 6MB per image (same as shelf scanner)",
    "Response time under 15 seconds for a typical invoice photo",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 4. PHASE 2 — SCANNER UI
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("4. Phase 2 \u2014 Scanner UI (scan button + accumulate into cart)"));

  out.push(h2("4.1 Rationale"));
  out.push(bodyPara(
    "Phase 2 builds the user-facing scanner. A 'Scan purchase sheet' button appears beside the existing search input in PurchaseForm. Tapping it opens a scanner modal where the user uploads one photo, sees the detected items, and can scan another page to accumulate more items. When done, the items flow into the existing purchase cart with detected fields pre-filled."
  ));

  out.push(h2("4.2 Scope"));

  out.push(featureCard("Feature 2.1", "'Scan purchase sheet' button in PurchaseForm", P.accent));
  out.push(bodyPara(
    "Add a button beside the search input with a ScanLine icon. Tapping it opens the new PurchaseScannerDialog. The existing search-and-add flow remains unchanged \u2014 the user can mix scanning and manual search in the same purchase."
  ));

  out.push(featureCard("Feature 2.2", "PurchaseScannerDialog component", P.accent));
  out.push(bodyPara(
    "New file src/modules/pharmacy/components/purchase/PurchaseScannerDialog.tsx. Three states: (1) Upload \u2014 file input + camera capture + instructions, (2) Scanning \u2014 loading spinner + 'Analyzing invoice...' text, (3) Results \u2014 list of detected items with matched/unmatched badges + 'Scan another page' button + 'Add N items to purchase' button. Each scanned page's items accumulate in a running list. The dialog stays open across multiple scans so the user can build the full purchase page by page."
  ));

  out.push(featureCard("Feature 2.3", "Accumulating scan results", P.accent));
  out.push(bodyPara(
    "Each scan response is appended to a scannedItems array in the dialog's state. If the same product is detected across multiple scans (same productId after matching), quantities are merged. The user sees a running total: '12 items from 2 scans'. When the user taps 'Add to purchase', all scanned items are converted to cart items and the dialog closes. The cart then shows the items with detected qty/batch/expiry/mrp pre-filled."
  ));

  out.push(featureCard("Feature 2.4", "Image compression + upload", P.aiAccent));
  out.push(bodyPara(
    "Reuses the shelf scanner's image compression logic (FileReader + canvas resize to max 2560px + JPEG quality 0.85). This keeps payloads under 6MB and scan times under 15 seconds. The compression happens client-side before the API call."
  ));

  out.push(h2("3.3 Schema changes"));
  out.push(bodyPara("None. The dialog is stateless UI \u2014 all data flows through the existing purchase cart + the P1 scan endpoint."));

  out.push(h2("4.4 UI changes"));
  out.push(bulletItem("Modify: PurchaseForm.tsx \u2014 add 'Scan purchase sheet' button beside search input"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/purchase/PurchaseScannerDialog.tsx (~250 lines)"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/purchase/ScannedItemList.tsx (~100 lines) \u2014 reusable list of detected items with badges"));

  out.push(h2("4.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "'Scan purchase sheet' button appears beside the search input in PurchaseForm",
    "Tapping the button opens the PurchaseScannerDialog",
    "User can upload one image \u2014 dialog shows 'Scanning...' state",
    "After scan, detected items appear with matched/unmatched badges",
    "'Scan another page' button lets user upload another image \u2014 items accumulate",
    "Duplicate products across scans merge quantities (no duplicate cart entries)",
    "'Add N items to purchase' button closes dialog + adds all items to the cart",
    "Cart items show detected qty/batch/expiry/mrp pre-filled (user can edit before save)",
    "Image is compressed client-side before upload (max 6MB)",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 5. PHASE 3 — REVIEW & EDIT
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("5. Phase 3 \u2014 Review & Edit Scanned Items"));

  out.push(h2("5.1 Rationale"));
  out.push(bodyPara(
    "AI vision is not perfect. A 50-item invoice might have 2\u20133 misreads (wrong quantity, garbled batch number, unmatched product). Phase 3 makes it easy for the user to catch and fix these before saving the purchase. Without this phase, the user would have to edit each cart item manually \u2014 losing the time savings the scanner provides."
  ));

  out.push(h2("5.2 Scope"));

  out.push(featureCard("Feature 3.1", "Confidence indicators on scanned items", P.amber));
  out.push(bodyPara(
    "The vision model returns a confidence score per item (or we infer it: high = exact catalog match, medium = fuzzy match, low = unmatched or garbled fields). Scanned items in the cart show a small colored dot: green (high confidence), amber (medium), red (low). The user can tap a filter to show only low-confidence items for quick review."
  ));

  out.push(featureCard("Feature 3.2", "Link unmatched items to existing products", P.accent));
  out.push(bodyPara(
    "Unmatched items (no catalog match) show a 'Link to product' button. Tapping it opens a searchable product directory (reuses the CatalogPicker pattern). The user searches, picks the right product, and the unmatched item is linked \u2014 the detected name is kept as a note for reference. If the product doesn't exist in the catalog, the user can tap 'Create new product' to open a minimal product form (name + generic + unit), then link."
  ));

  out.push(featureCard("Feature 3.3", "Inline edit of detected fields", P.accent));
  out.push(bodyPara(
    "Each scanned cart item's fields (quantity, batchNo, expiryDate, mrp, unitCost) are editable inline. The detected values are pre-filled but the user can correct any field. Fields with low confidence are highlighted with a subtle amber border to draw attention. Validation: batch + expiry are required before save (existing purchase requirement)."
  ));

  out.push(featureCard("Feature 3.4", "Remove misdetected items", P.accent));
  out.push(bodyPara(
    "If the vision model detects a phantom item (e.g. reads 'Total: 500 BDT' as a product), the user can swipe or tap a trash icon to remove it from the cart. A confirmation prevents accidental deletion."
  ));

  out.push(h2("5.3 Schema changes"));
  out.push(bodyPara("None. Confidence + matched state are stored in the cart item's client-side state and submitted with the purchase."));

  out.push(h2("5.4 UI changes"));
  out.push(bulletItem("Modify: PurchaseForm.tsx cart items \u2014 add confidence dot + 'Link to product' button for unmatched + amber border on low-confidence fields"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/purchase/LinkProductDialog.tsx (~120 lines) \u2014 searchable directory to link unmatched items"));
  out.push(bulletItem("Modify: cart item validation \u2014 highlight missing batch/expiry before save"));

  out.push(h2("5.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "Each scanned cart item shows a confidence dot (green/amber/red)",
    "Filter to show only low-confidence items works",
    "Unmatched items show 'Link to product' button",
    "Link dialog searches the product directory + links on tap",
    "'Create new product' shortcut in link dialog creates a minimal product then links",
    "All cart item fields (qty, batch, expiry, mrp, unitCost) are editable inline",
    "Low-confidence fields show amber border",
    "Remove button on each item with confirmation",
    "Save is blocked if any item is missing batch or expiry (existing validation preserved)",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 6. PHASE 4 — POLISH & EDGE CASES
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("6. Phase 4 \u2014 Polish & Edge Cases"));

  out.push(h2("6.1 Rationale"));
  out.push(bodyPara(
    "Phase 4 handles the edge cases that determine whether the feature feels polished or frustrating: what if the scan fails? what if the photo is blurry? what if the invoice is handwritten? This phase adds help text, a manual fallback, super-admin documentation, and tuning based on real invoice photos."
  ));

  out.push(h2("6.2 Scope"));

  out.push(featureCard("Feature 4.1", "Help text + tips in the scanner dialog", P.accent));
  out.push(bodyPara(
    "The upload state of PurchaseScannerDialog shows 3 tips: (1) 'Frame the entire invoice \u2014 all 4 corners visible', (2) 'Ensure good lighting \u2014 avoid shadows on text', (3) 'If the invoice is long, scan each page separately \u2014 items accumulate automatically'. A small 'See example' link opens an image of a sample invoice with annotations."
  ));

  out.push(featureCard("Feature 4.2", "Manual fallback when scan fails", P.accent));
  out.push(bodyPara(
    "If the scan endpoint returns an error (vision model failure, rate limit, garbled JSON), the dialog shows a friendly message: 'Couldn't read this photo. Try a clearer photo, or add items manually via search.' with two buttons: 'Retry scan' + 'Add manually'. The manual fallback closes the dialog and focuses the existing search input so the user can continue without losing flow."
  ));

  out.push(featureCard("Feature 4.3", "SuperAdmin documentation + prompt tuning", P.aiAccent));
  out.push(bodyPara(
    "Add a 'Purchase Scanner' help entry to SuperAdminHelp.tsx under Operations. Add the purchase-scan prompt to the super-admin ShelfScannerConfigCard (or a new config card) so the founder can tune the prompt for Bangladesh pharmacy invoices (which often have mixed English + Bangla, abbreviations, and specific layout patterns). Track purchase-scan usage in the existing AI usage dashboard."
  ));

  out.push(featureCard("Feature 4.4", "Invoice photo best practices in onboarding", P.accent));
  out.push(bodyPara(
    "The first time a user opens the purchase scanner, show a one-time tooltip highlighting the scan button + a 3-slide mini-tutorial (photograph \u2192 review \u2192 save). This can be a simple dismissible banner rather than a full modal."
  ));

  out.push(h2("6.3 Schema changes"));
  out.push(bodyPara("None."));

  out.push(h2("6.4 UI + doc changes"));
  out.push(bulletItem("Modify: PurchaseScannerDialog upload state \u2014 add 3 tips + 'See example' link"));
  out.push(bulletItem("Modify: PurchaseScannerDialog error state \u2014 add 'Retry' + 'Add manually' buttons"));
  out.push(bulletItem("Modify: SuperAdminHelp.tsx \u2014 add 'Purchase Scanner' help entry"));
  out.push(bulletItem("Modify: admin ShelfScannerConfigCard.tsx (or new PurchaseScannerConfigCard) \u2014 add purchase-scan prompt editing"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/purchase/PurchaseScanTips.tsx (~60 lines) \u2014 reusable tips banner"));

  out.push(h2("6.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "Scanner dialog upload state shows 3 tips with clear illustrations",
    "On scan failure, dialog shows friendly message + 'Retry scan' + 'Add manually' buttons",
    "'Add manually' closes dialog + focuses the search input",
    "SuperAdminHelp has 'Purchase Scanner' entry with whatItIs/whyYouNeedIt/howToUse",
    "Super-admin can edit the purchase-scan prompt from /admin",
    "Purchase-scan usage appears in the AI usage dashboard (feature breakdown)",
    "First-time user sees a dismissible tooltip highlighting the scan button",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 7. IMPLEMENTATION TRACKING
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("7. Implementation Tracking"));

  out.push(h2("7.1 Phase status"));
  out.push(bodyPara(
    "The table below is the single source of truth for purchase scanner progress. It is duplicated in PROJECT_CONTEXT.md \u00a717 so any agent starting a new session can see the current state at a glance. Update both this doc and PROJECT_CONTEXT.md when a phase status changes."
  ));
  out.push(tableCaption("Table 5: Phase status tracker"));
  out.push(phaseOverviewTable());
  out.push(spacer(240));

  out.push(h2("7.2 Worklog protocol"));
  out.push(bodyPara(
    "Each phase gets one worklog.md entry on completion, using the Task ID pattern purchase-scan-pN (where N is the phase number). The entry follows the standard template (Task ID / Agent / Task / Work Log / Stage Summary) and must reference this spec doc. After committing a phase, update the status column in Table 5 above and in PROJECT_CONTEXT.md \u00a717 to 'Done' with the tag."
  ));

  out.push(h2("7.3 Commit + tag convention"));
  out.push(bulletItem("Commit message: feat(purchase): P1 \u2014 vision scan API + catalog matching"));
  out.push(bulletItem("Tag on phase completion: v1.7.0-purchase-scan-p1, v1.7.1-purchase-scan-p2, etc."));
  out.push(bulletItem("All changes go through the pre-push guardrail (scripts/pre-push-check.sh) per DEPLOYMENT_WORKFLOW.md"));

  out.push(h2("7.4 Sequencing dependencies"));
  out.push(bodyPara(
    "Phases are strictly sequential \u2014 each builds on the previous:"
  ));
  out.push(bulletItem("P2 (UI) depends on P1 (API) \u2014 the dialog calls the scan endpoint"));
  out.push(bulletItem("P3 (review) depends on P2 (UI) \u2014 confidence + link features operate on cart items added by the scanner"));
  out.push(bulletItem("P4 (polish) depends on P3 (review) \u2014 help text + fallback reference the review flow"));
  out.push(calloutPara(
    "Recommended order: P1 \u2192 P2 \u2192 P3 \u2192 P4. No parallelism \u2014 each phase's output is the next phase's input.",
    P.aiAccent
  ));

  out.push(h2("7.5 Estimated total effort"));
  out.push(tableCaption("Table 6: Effort estimate per phase"));
  out.push(makeTable(
    ["Phase", "Sessions", "Notes"],
    [
      ["P1", "1\u20132", "Backend: endpoint + prompt + matching. Largest backend phase."],
      ["P2", "1", "UI: dialog + accumulation logic. Reuses shelf scanner compression."],
      ["P3", "1", "Review UX: confidence + link + inline edit"],
      ["P4", "1", "Polish: tips + fallback + admin docs"],
      [{ text: "Total", bold: true, fill: P.surface }, { text: "4\u20135 sessions", bold: true, fill: P.surface }, { text: "Approx 1 week of part-time work", fill: P.surface }],
    ],
    [15, 20, 65]
  ));

  out.push(h2("7.6 Risk + mitigation"));
  out.push(tableCaption("Table 7: Key risks and mitigations"));
  out.push(makeTable(
    ["Risk", "Likelihood", "Mitigation"],
    [
      ["Vision model misreads batch/expiry", "Medium", "P3 confidence indicators + inline edit + required-field validation before save"],
      ["Invoice photo too blurry", "Medium", "P4 help text + manual fallback to search"],
      ["Unmatched products common (new SKUs)", "High", "P3 'Link to product' + 'Create new product' shortcut"],
      ["Rate limit hit on multi-page invoices", "Low", "Each scan is 1 AI call; burst limit is 5/60s \u2014 user can't scan that fast"],
      ["Bangla text on invoice not OCR'd", "Medium", "Prompt tuned for mixed-language; fallback to manual entry"],
    ],
    [35, 15, 50]
  ));

  return out;
}

module.exports = { buildBody, phaseOverviewTable };
