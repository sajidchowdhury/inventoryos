// SCD Enhancement Plan — Body builder
// Produces an array of Paragraph/Table elements for the body section.
// Reuses helpers from ai-report-helpers.js (H).

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

// ─── Phase table builder (reused in tracking section) ─────────────────────
function phaseOverviewTable() {
  return makeTable(
    ["Phase", "Theme", "Features", "Effort", "Status"],
    [
      [{ text: "P1", bold: true, fill: P.surface }, "Onboarding & Resume", "Empty state, resume count UX", "1 session", "Pending"],
      [{ text: "P2", bold: true, fill: P.surface }, "Variance UX", "Search/filter, reason capture", "1 session", "Pending"],
      [{ text: "P3", bold: true, fill: P.surface }, "Smart Zones", "Zone inheritance + scan-to-assign + manual add", "2 sessions", "Pending"],
      [{ text: "P4", bold: true, fill: P.surface }, "Export & History", "PDF/Excel export, history detail view", "1 session", "Pending"],
      [{ text: "P5", bold: true, fill: P.surface }, "Reminders", "Scheduled monthly nudge", "1 session", "Pending"],
    ],
    [10, 28, 35, 17, 10]
  );
}

// ─── Feature card (callout with colored left border) ──────────────────────
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

// ─── Acceptance criteria list ─────────────────────────────────────────────
function acceptanceCriteria(items) {
  return items.map((item, i) => new Paragraph({
    spacing: { line: 312, before: 0, after: 80 },
    indent: { left: 360, hanging: 240 },
    children: [
      new TextRun({ text: "\u2610  ", size: 22, color: c(P.accent), bold: true }),
      new TextRun({ text: item, size: 22, color: c(P.body), font: { ascii: "Calibri" } }),
    ],
  }));
}

// ─── Build the full body ──────────────────────────────────────────────────
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
    "Stock Count Day (SCD) is the pharmacy's monthly compliance ritual: physically count every medicine, compare to system stock, and record variances. The current implementation delivers the core flow \u2014 zones, multi-zone counting, shelf-scanner integration, variance review, and apply-to-inventory \u2014 but an audit against real pharmacy workflows surfaced eight gaps that limit adoption and auditability."
  ));

  out.push(bodyPara(
    "This document specifies a phased plan to close those gaps. Each phase is independently shippable: a pharmacy can adopt P1 (onboarding) without waiting for P3 (smart zones), and the platform remains backward-compatible at every step. The features are sequenced by user-impact-to-effort ratio \u2014 onboarding and resume-UX first (highest frustration, lowest effort), then variance UX, then the larger smart-zone investment, then export and reminders as polish."
  ));

  out.push(h3("What this plan delivers"));
  out.push(bulletItem("A first-time user can understand why SCD matters and set up zones in under 2 minutes (P1)."));
  out.push(bulletItem("A counter who leaves mid-zone can resume exactly where they stopped \u2014 no re-counting (P1)."));
  out.push(bulletItem("A pharmacy with 500+ products can find mismatches in seconds via search and filter (P2)."));
  out.push(bulletItem("Every variance carries a reason code (theft, damage, data error, expired, other) for audit trail (P2)."));
  out.push(bulletItem("Zone assignments auto-inherit from the previous SCD, eliminating the largest setup burden (P3)."));
  out.push(bulletItem("During counting, staff can add an unscanned product in two taps via a searchable directory (P3)."));
  out.push(bulletItem("Count sheets and variance reports export to PDF and Excel for regulators and accountants (P4)."));
  out.push(bulletItem("Past SCDs are fully browsable \u2014 tap any history row to see its variances and counts (P4)."));
  out.push(bulletItem("A monthly reminder nudges managers who haven't run SCD yet (P5)."));

  out.push(h3("Phase overview"));
  out.push(tableCaption("Table 1: Phase overview \u2014 themes, features, effort, and tracking status"));
  out.push(phaseOverviewTable());
  out.push(spacer(240));

  out.push(calloutPara(
    "Tracking: After this spec is approved, a new \u00a716 is added to PROJECT_CONTEXT.md. Each phase gets a status row that is updated as work completes. The worklog.md receives one entry per phase using the Task ID pattern scd-enhance-p1 through scd-enhance-p5.",
    P.aiAccent
  ));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 2. CURRENT STATE & GAP ANALYSIS
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("2. Current State & Gap Analysis"));

  out.push(h2("2.1 What SCD does today"));
  out.push(bodyPara(
    "The SCD module lives at src/modules/pharmacy/components/StockCountDayHub.tsx (1,011 lines) and exposes a four-screen flow: Hub \u2192 Setup Zones \u2192 Start Count Day \u2192 Zone Counting \u2192 Variance Review \u2192 Apply. It is backed by four Prisma models (StockCountDay, StockCountZoneSession, StockCountProductSummary, StockCountLine) and four API routes under /api/businesses/[id]/stock-count-day/."
  ));
  out.push(bodyPara(
    "The current implementation's strengths are: sales continue during the count (systemQtyAtStart minus soldDuringScd gives the expected-now figure), multi-zone awareness (counters see what was counted in other zones for the same product), shelf-scanner AI integration, and a variance-review gate before stock is applied. These strengths are preserved by every phase in this plan."
  ));

  out.push(h2("2.2 The eight gaps"));
  out.push(bodyPara(
    "The following gaps were identified by auditing the current UI against a real pharmacy's monthly count workflow. Each gap is restated here with its user-impact severity and the phase that closes it."
  ));

  out.push(tableCaption("Table 2: Gap analysis with severity and resolving phase"));
  out.push(makeTable(
    ["#", "Gap", "User impact", "Severity", "Phase"],
    [
      ["1", "No empty state explaining why SCD matters", "First-time users skip SCD entirely", "High", "P1"],
      ["2", "No resume-count UX after navigating away", "Counters re-count from scratch", "High", "P1"],
      ["3", "Variance review has no search/filter", "500+ products = unworkable scroll", "High", "P2"],
      ["4", "No reason-for-variance capture", "Audit trail incomplete for regulators", "High", "P2"],
      ["5", "No export (PDF/Excel)", "Cannot share count with accountant/regulator", "Medium", "P4"],
      ["6", "No scheduled reminders", "Pharmacies forget to run monthly count", "Medium", "P5"],
      ["7", "History is read-only (no detail view)", "Cannot investigate past variances", "Medium", "P4"],
      ["8", "Zone assignment is a huge manual task", "Adoption blocker for new pharmacies", "Critical", "P3"],
    ],
    [6, 32, 30, 14, 10]
  ));
  out.push(spacer(200));

  out.push(h2("2.3 The zone-assignment problem (founder's proposal)"));
  out.push(bodyPara(
    "Gap #8 deserves special attention because it is the largest adoption blocker. Today, before a pharmacy can run its first SCD, a manager must manually assign every product to one or more storage zones via the ZoneBulkAssign component. For a pharmacy with 500 products across 4 zones, that is 2,000 potential assignment operations \u2014 a multi-hour task that most pharmacies will abandon."
  ));
  out.push(bodyPara(
    "The founder proposed a two-pronged solution that this plan adopts as Phase 3. First, if the pharmacy has run a previous SCD, the zone assignments from that SCD are inherited automatically \u2014 the manager only adjusts deltas. Second, when a counter scans a zone and finishes counting, every product they counted is automatically assigned to that zone for future SCDs. This means the first SCD is a one-time setup cost, and every subsequent SCD gets progressively smarter as the system learns which products live where."
  ));
  out.push(calloutPara(
    "Founder's intuition confirmed: yes, this is a good idea. It converts zone assignment from a 'set up everything before you start' task into a 'the system learns as you count' workflow \u2014 a classic shift from upfront cost to incremental cost that dramatically improves first-time adoption.",
    P.aiAccent
  ));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 3. PHASE 1 — ONBOARDING & RESUME
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("3. Phase 1 \u2014 Onboarding & Resume Count UX"));

  out.push(h2("3.1 Rationale"));
  out.push(bodyPara(
    "Two of the eight gaps share a common root cause: the SCD hub assumes the user already knows what SCD is and never gets interrupted mid-count. Phase 1 closes both gaps with minimal schema change \u2014 the work is almost entirely in the UI layer. This makes P1 the fastest phase to ship and the one with the highest frustration reduction per hour of engineering."
  ));

  out.push(h2("3.2 Scope"));
  out.push(featureCard("Feature 1.1", "First-time empty state with 'why SCD matters' explainer", P.accent));
  out.push(bodyPara(
    "When a pharmacy has zero zones AND zero past SCDs, the hub replaces the current 'Manage zones' button with a full-screen onboarding card. The card has three sections: (a) a headline explaining the compliance and theft-detection value of monthly counts, (b) a 3-step visual walkthrough (set up zones \u2192 count each zone \u2192 apply to inventory), and (c) a single primary CTA 'Set up your first zone'. Tapping the CTA opens the existing setup-zones screen."
  ));
  out.push(bodyPara(
    "Implementation: a new component ScdOnboardingCard.tsx rendered conditionally in StockCountDayHub.tsx when zones.length === 0 && history.length === 0. No schema or API change. The explainer copy is bilingual (English + Bangla) to match the existing app pattern."
  ));

  out.push(featureCard("Feature 1.2", "Resume count UX \u2014 auto-return to in-progress zone", P.accent));
  out.push(bodyPara(
    "When a counter navigates away from a zone-count screen (e.g. taps the back button, switches tabs, or closes the browser) while a zone session is in 'counting' status, the next time they open SCD the hub detects the in-progress session and shows a prominent 'Resume counting {zone name}' banner at the top. Tapping it reloads the exact zone-count screen with all previously entered quantities preserved (they are already persisted in StockCountLine.countedQty)."
  ));
  out.push(bodyPara(
    "Implementation: the existing GET /api/businesses/[id]/stock-count-day endpoint already returns the active SCD with its zoneSessions. The hub adds a check: if any zoneSession has status 'counting', render the resume banner. No schema change; one small API enhancement to include zoneSession.lineCount in the response so the banner can show '12 of 50 products counted'."
  ));

  out.push(h2("3.3 Schema changes"));
  out.push(bodyPara("None. Both features use existing models and fields."));

  out.push(h2("3.4 API changes"));
  out.push(tableCaption("Table 3: P1 API changes"));
  out.push(makeTable(
    ["Route", "Change", "Reason"],
    [
      ["GET /stock-count-day", "Add zoneSession.lineCount + zoneSession.lastCountedAt to response", "Resume banner shows progress without an extra fetch"],
    ],
    [40, 35, 25]
  ));
  out.push(spacer(160));

  out.push(h2("3.5 UI changes"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/scd/ScdOnboardingCard.tsx (~80 lines)"));
  out.push(bulletItem("Modify: StockCountDayHub.tsx \u2014 render ScdOnboardingCard when zones.length === 0 && history.length === 0"));
  out.push(bulletItem("Modify: StockCountDayHub.tsx \u2014 add 'Resume counting' banner when any zoneSession.status === 'counting'"));
  out.push(bulletItem("Modify: BottomNav.tsx \u2014 'stock-count-day' view already in inventory-hub group (added in prior commit)"));

  out.push(h2("3.6 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "First-time pharmacy (0 zones, 0 history) sees the onboarding card, not the empty 'Manage zones' button",
    "Onboarding card explains why SCD matters in 2 sentences or fewer",
    "Tapping 'Set up your first zone' opens the existing setup-zones screen",
    "Counter who navigates away mid-zone sees 'Resume counting {zone}' banner on return",
    "Tapping the resume banner reloads the zone-count screen with all previously saved quantities intact",
    "Existing flows (start SCD, count, close zone, variance review, apply) are unchanged",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 4. PHASE 2 — VARIANCE UX
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("4. Phase 2 \u2014 Variance Search, Filter & Reason Capture"));

  out.push(h2("4.1 Rationale"));
  out.push(bodyPara(
    "The variance review screen is where the pharmacist decides whether to apply the count. For a 500-product pharmacy with 80 variances, the current flat list is unworkable \u2014 the pharmacist scrolls for minutes looking for the one product they care about. Worse, when stock is short, the system records that there WAS a variance but not WHY, leaving the audit trail incomplete for the regulator who asks 'why is 30 strips of Napa missing?'"
  ));

  out.push(h2("4.2 Scope"));
  out.push(featureCard("Feature 2.1", "Search + filter on variance review screen", P.accent));
  out.push(bodyPara(
    "Add a search input (filter by product name or generic name) and three filter chips: 'Mismatches only' (default), 'Not counted only', 'Matched only'. The list re-renders live as the user types or toggles chips. The three stat cards (Matched / Mismatch / Not counted) at the top become tappable to act as quick filters."
  ));

  out.push(featureCard("Feature 2.2", "Reason-for-variance capture", P.amber));
  out.push(bodyPara(
    "Each variance row gets a 'Record reason' button that opens a small dialog with five preset reasons (Theft/suspected theft, Damage/spoilage, Data entry error, Expired/disposed without record, Other) plus an optional free-text note. The reason is stored on the StockCountProductSummary model in a new varianceReason field and surfaced in the variance list and in the exported report (P4)."
  ));

  out.push(h2("4.3 Schema changes"));
  out.push(tableCaption("Table 4: P2 Prisma schema additions"));
  out.push(makeTable(
    ["Model", "New field", "Type", "Notes"],
    [
      ["StockCountProductSummary", "varianceReason", "String?", "Enum-ish: theft | damage | data_error | expired | other"],
      ["StockCountProductSummary", "varianceNote", "String?", "Optional free-text up to 500 chars"],
    ],
    [35, 25, 15, 25]
  ));
  out.push(spacer(160));
  out.push(bodyPara(
    "Migration: run npx prisma db push after editing schema.prisma. Both fields are nullable so existing rows are unaffected. No data backfill required."
  ));

  out.push(h2("4.4 API changes"));
  out.push(tableCaption("Table 5: P2 API changes"));
  out.push(makeTable(
    ["Route", "Change", "Reason"],
    [
      ["GET /stock-count-day/[scdId]", "Include varianceReason + varianceNote in summaries", "Variance list shows reason badges"],
      ["PATCH /stock-count-day/[scdId]", "Accept action: 'setReason' with { productId, reason, note }", "Dialog saves reason without full re-apply"],
    ],
    [40, 35, 25]
  ));
  out.push(spacer(160));

  out.push(h2("4.5 UI changes"));
  out.push(bulletItem("Modify: StockCountDayHub.tsx variance-review screen \u2014 add search input + filter chips + tappable stat cards"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/scd/VarianceReasonDialog.tsx (~120 lines)"));
  out.push(bulletItem("Modify: variance list rows \u2014 show reason badge if set, 'Record reason' button if not"));

  out.push(h2("4.6 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "Search input filters variance list by product name (case-insensitive, debounced 200ms)",
    "Three filter chips (Mismatch / Not counted / Matched) toggle correctly and combine with search",
    "Tapping a stat card applies the corresponding filter chip",
    "'Record reason' dialog shows 5 preset reasons + optional note field",
    "Saved reason appears as a colored badge on the variance row",
    "Reason persists across page reloads (verified in DB)",
    "Variance review still allows apply without setting reasons (reasons are optional but recommended)",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 5. PHASE 3 — SMART ZONE INHERITANCE & COUNTING-TIME ASSIGNMENT
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("5. Phase 3 \u2014 Smart Zone Inheritance & Counting-Time Assignment"));

  out.push(h2("5.1 Rationale"));
  out.push(bodyPara(
    "This is the largest phase and the highest-impact one. It eliminates the single biggest adoption blocker: the upfront zone-assignment burden. The phase has three sub-features that work together: (a) inherit zone assignments from the previous SCD, (b) auto-assign products to a zone when they are counted in that zone during an SCD, and (c) add a manual 'add product from directory' button in the zone-count screen for products the shelf scanner missed."
  ));

  out.push(h2("5.2 Scope"));

  out.push(featureCard("Feature 3.1", "Zone inheritance from previous SCD", P.aiAccent));
  out.push(bodyPara(
    "When a manager starts a new SCD, the system checks if the business has any previous SCD with status 'applied'. If yes, it copies the ProductZoneAssignment rows from the time of that SCD (using a new snapshot table \u2014 see schema) into the new SCD's zone sessions as pre-populated count lines. The manager sees a banner: 'Inherited N zone assignments from your last count on {date}. Adjust if needed.' and can add or remove assignments before starting."
  ));
  out.push(bodyPara(
    "Implementation: this is the trickiest part. ProductZoneAssignment is a live table that changes over time, but we need the assignments AS THEY WERE at the time of the previous SCD. Solution: snapshot assignments into a new ZoneAssignmentSnapshot table at SCD creation time. The new SCD reads from the most recent snapshot."
  ));

  out.push(featureCard("Feature 3.2", "Scan-to-assign: counting a product auto-assigns it to that zone", P.aiAccent));
  out.push(bodyPara(
    "During zone counting, every time a counter saves a countedQty for a product in a zone, the system upserts a ProductZoneAssignment row for that product+zone if one doesn't already exist. This means: first-time pharmacies don't need to pre-assign anything \u2014 they just count what they see, and the system learns the zone layout. By the end of the first SCD, every counted product is assigned to the zone where it was found, so the second SCD inherits a complete assignment map."
  ));
  out.push(bodyPara(
    "This feature is what makes the founder's proposal work: the first SCD is the 'setup' SCD (count what you see), and every subsequent SCD benefits from the inherited map. The ZoneBulkAssign component becomes an optional power-user tool instead of a mandatory first step."
  ));

  out.push(featureCard("Feature 3.3", "Manual 'add product from directory' button in zone-count screen", P.amber));
  out.push(bodyPara(
    "Beside the existing 'Photo scan this shelf' button, add a second button 'Add product manually'. Tapping it opens a searchable product directory (reuses the CatalogPicker pattern). The counter searches by name or generic, picks a product, and it gets added to the zone's count lines with countedQty = 0 (counter then enters the qty). If the product doesn't exist in the directory, the counter can tap 'Add new product' which opens a lightweight product-create form (name + generic + unit, all other fields optional)."
  ));
  out.push(bodyPara(
    "This handles the edge case where the shelf scanner missed a product (poor lighting, obscured label) and the counter doesn't want to take another photo \u2014 they just search and tap."
  ));

  out.push(h2("5.3 Schema changes"));
  out.push(tableCaption("Table 6: P3 Prisma schema additions"));
  out.push(makeTable(
    ["Model", "New field/relation", "Type", "Notes"],
    [
      ["ZoneAssignmentSnapshot (NEW)", "id, scdId, businessId, productId, zoneId, createdAt", "Snapshot of assignments at SCD creation time", "Enables inheritance from past SCDs"],
      ["StockCountLine", "autoAssigned", "Boolean @default(false)", "True if assignment was created by scan-to-assign"],
      ["ProductZoneAssignment", "(no new fields)", "\u2014", "Existing table; upserted during count"],
    ],
    [25, 30, 25, 20]
  ));
  out.push(spacer(160));

  out.push(h2("5.4 API changes"));
  out.push(tableCaption("Table 7: P3 API changes"));
  out.push(makeTable(
    ["Route", "Change", "Reason"],
    [
      ["POST /stock-count-day", "Snapshot current ProductZoneAssignment rows into ZoneAssignmentSnapshot; if previous SCD exists, copy its snapshot into new SCD's zone sessions as pre-populated lines", "Inheritance"],
      ["PATCH /zones/[zoneSessionId] action=count", "After saving countedQty, upsert ProductZoneAssignment(productId, zoneId) and set line.autoAssigned=true if newly created", "Scan-to-assign"],
      ["POST /zones/[zoneSessionId]/add-line", "New endpoint: accepts productId, adds line to zone session with countedQty=0", "Manual add from directory"],
    ],
    [30, 45, 25]
  ));
  out.push(spacer(160));

  out.push(h2("5.5 UI changes"));
  out.push(bulletItem("Modify: StockCountDayHub.tsx start-scd screen \u2014 show 'Inherited N assignments' banner when applicable"));
  out.push(bulletItem("Modify: zone-count screen \u2014 add 'Add product manually' button beside 'Photo scan this shelf'"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/scd/ZoneAddProductDialog.tsx (~150 lines) \u2014 searchable directory + 'add new product' shortcut"));
  out.push(bulletItem("Modify: ZoneBulkAssign.tsx \u2014 add note 'Optional \u2014 most pharmacies let the system learn from counting'"));

  out.push(h2("5.6 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "First SCD (no previous): zone sessions start empty, counter counts what they see",
    "During counting, every saved qty creates/updates ProductZoneAssignment for that product+zone",
    "Second SCD: manager sees 'Inherited N assignments from {date}' banner on start screen",
    "Inherited assignments pre-populate zone count lines (counter sees them on entering zone)",
    "'Add product manually' button opens searchable directory of business's products",
    "Selecting a product from directory adds it to the zone count lines with qty=0",
    "'Add new product' shortcut in directory creates a minimal product and adds it to the zone",
    "ZoneBulkAssign remains available but is no longer required to start an SCD",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 6. PHASE 4 — EXPORT & HISTORY DETAIL
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("6. Phase 4 \u2014 Export & History Detail View"));

  out.push(h2("6.1 Rationale"));
  out.push(bodyPara(
    "Pharmacy regulators in Bangladesh require documented evidence of stock counts and variance resolutions. Today, the only way to share an SCD result is to screenshot the variance review screen \u2014 unprofessional and incomplete. Phase 4 adds proper PDF and Excel export, and makes past SCDs browsable so pharmacists can investigate 'what happened last month' without asking engineering to query the DB."
  ));

  out.push(h2("6.2 Scope"));

  out.push(featureCard("Feature 4.1", "PDF + Excel export of count sheet and variance report", P.accent));
  out.push(bodyPara(
    "On the variance review screen (for active/closed SCDs) and on the history detail view (for past SCDs), add two export buttons: 'Export PDF' and 'Export Excel'. The PDF is a formatted one-page-per-zone count sheet with business header, SCD date, zone name, product list (name, expected, counted, variance, reason). The Excel is a multi-sheet workbook: one sheet per zone + a summary sheet with variances and reasons."
  ));
  out.push(bodyPara(
    "Implementation: PDF uses the existing PDF skill (ReportLab via Python). Excel uses a server-side xlsx generator (the existing xlsx skill or exceljs). Both are generated on the server and streamed as downloads. The export endpoint is GET /api/businesses/[id]/stock-count-day/[scdId]/export?format=pdf|excel."
  ));

  out.push(featureCard("Feature 4.2", "History detail view \u2014 tap any past SCD to see its variances", P.accent));
  out.push(bodyPara(
    "The current history list is read-only. Phase 4 makes each history row tappable, opening a read-only variant of the variance review screen for that past SCD. The manager sees the same stat cards (Matched / Mismatch / Not counted), the same variance list with reasons, and the export buttons. This is also where P5 reminders link to \u2014 'you haven't run SCD this month, here's last month's report'."
  ));

  out.push(h2("6.3 Schema changes"));
  out.push(bodyPara("None. Exports read from existing models. History detail reuses the existing GET /stock-count-day/[scdId] endpoint."));

  out.push(h2("6.4 API changes"));
  out.push(tableCaption("Table 8: P4 API changes"));
  out.push(makeTable(
    ["Route", "Change", "Reason"],
    [
      ["GET /stock-count-day/[scdId]/export?format=pdf", "New endpoint: streams PDF", "Export count sheet + variance report"],
      ["GET /stock-count-day/[scdId]/export?format=excel", "New endpoint: streams .xlsx", "Same data, Excel format for accountants"],
      ["GET /stock-count-day/[scdId]", "Already exists; ensure it returns full summaries with reasons for past SCDs", "History detail view"],
    ],
    [35, 40, 25]
  ));
  out.push(spacer(160));

  out.push(h2("6.5 UI changes"));
  out.push(bulletItem("Modify: variance review screen \u2014 add 'Export PDF' + 'Export Excel' buttons in header"));
  out.push(bulletItem("Modify: history list rows \u2014 make tappable, navigate to new 'history-detail' screen"));
  out.push(bulletItem("New screen state: 'history-detail' \u2014 read-only variance review with export buttons"));
  out.push(bulletItem("New file: src/modules/pharmacy/components/scd/ScdExportButtons.tsx (~60 lines)"));

  out.push(h2("6.6 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "Variance review screen has 'Export PDF' and 'Export Excel' buttons",
    "PDF export downloads a formatted .pdf with business header, SCD date, per-zone count sheet, variance summary",
    "Excel export downloads a .xlsx with one sheet per zone + summary sheet",
    "History list rows are tappable and open the history-detail screen",
    "History-detail screen shows the same stat cards + variance list as the live variance review (read-only)",
    "History-detail screen has working export buttons",
    "Exports work for SCDs in any status (active, closed, applied)",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 7. PHASE 5 — SCHEDULED REMINDERS
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("7. Phase 5 \u2014 Scheduled Monthly Reminders"));

  out.push(h2("7.1 Rationale"));
  out.push(bodyPara(
    "Even with a smooth UX, pharmacies forget to run monthly counts. Phase 5 adds a cron-driven reminder that nudges managers who haven't started an SCD in the current calendar month. The reminder is sent via the existing notification system (in-app + email if SMTP configured) and includes a deep link to the SCD hub."
  ));

  out.push(h2("7.2 Scope"));
  out.push(featureCard("Feature 5.1", "Monthly SCD reminder cron job", P.accent));
  out.push(bodyPara(
    "A new cron job scd-monthly-reminder runs on the 25th of every month at 09:00 local time. For each active business, it checks: did this business run an SCD (status applied or closed) in the current calendar month? If no, it creates a NotificationLog entry with type 'scd_reminder' and a deep link to the SCD hub. If the business has ownerEmail set and SMTP is configured, it also sends an email."
  ));
  out.push(bodyPara(
    "The reminder is intentionally NOT sent on the 1st \u2014 the 25th gives the pharmacy a week to act before month-end, which is when most pharmacies want to close their books."
  ));

  out.push(h2("7.3 Schema changes"));
  out.push(bodyPara("None. Uses existing NotificationLog and Business.ownerEmail. The reminder logic is purely in the cron job."));

  out.push(h2("7.4 API + cron changes"));
  out.push(tableCaption("Table 9: P5 cron + API changes"));
  out.push(makeTable(
    ["Component", "Change", "Reason"],
    [
      ["CRON_JOB_NAMES", "Add SCD_MONTHLY_REMINDER: 'scd-monthly-reminder'", "New job registration"],
      ["CRON_JOB_SCHEDULES", "schedule: '0 4 25 * *' (09:00 Asia/Dhaka = 04:00 UTC on 25th)", "Monthly on the 25th"],
      ["cron-jobs.ts", "New runScdMonthlyReminderJob() function", "Job implementation"],
      ["POST /api/cron/scd-monthly-reminder", "New endpoint (x-cron-secret auth)", "External scheduler trigger"],
      ["trigger-cron/[jobName]", "Add scd-monthly-reminder to JOB_RUNNERS map", "Manual trigger from /admin"],
    ],
    [25, 40, 35]
  ));
  out.push(spacer(160));

  out.push(h2("7.5 UI changes"));
  out.push(bulletItem("Modify: NotificationCenter.tsx \u2014 render scd_reminder notifications with a teal 'Run count' CTA button"));
  out.push(bulletItem("Modify: /admin SuperAdminHelp.tsx \u2014 add 'SCD Monthly Reminder' help entry under Operations"));
  out.push(bulletItem("No new SCD-hub UI \u2014 the reminder links INTO the existing hub"));

  out.push(h2("7.6 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "Cron job scd-monthly-reminder is registered in CRON_JOB_NAMES + CRON_JOB_SCHEDULES",
    "Job queries all active businesses and checks for an SCD in the current calendar month",
    "Businesses without a recent SCD get a NotificationLog entry with type 'scd_reminder'",
    "If ownerEmail + SMTP configured, an email is also sent",
    "Notification renders in NotificationCenter with a 'Run count' button that navigates to SCD hub",
    "Job is triggerable manually from /admin via trigger-cron/scd-monthly-reminder",
    "Job logs to CronJobLog on every run (success or failure)",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 8. IMPLEMENTATION TRACKING
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("8. Implementation Tracking"));

  out.push(h2("8.1 Phase status"));
  out.push(bodyPara(
    "The table below is the single source of truth for SCD enhancement progress. It is duplicated in PROJECT_CONTEXT.md \u00a716 so that any agent starting a new session can see the current state at a glance. Update both this doc and PROJECT_CONTEXT.md when a phase status changes."
  ));
  out.push(tableCaption("Table 10: Phase status tracker"));
  out.push(phaseOverviewTable());
  out.push(spacer(240));

  out.push(h2("8.2 Worklog protocol"));
  out.push(bodyPara(
    "Each phase gets one worklog.md entry on completion, using the Task ID pattern scd-enhance-pN (where N is the phase number). The entry follows the standard template (Task ID / Agent / Task / Work Log / Stage Summary) and must reference this spec doc. After committing a phase, update the status column in Table 10 above and in PROJECT_CONTEXT.md \u00a716 to 'Done' with the commit SHA."
  ));

  out.push(h2("8.3 Commit + tag convention"));
  out.push(bulletItem("Commit message: feat(scd): P1 \u2014 onboarding + resume count UX"));
  out.push(bulletItem("Tag on phase completion: v1.6.0-scd-p1, v1.6.1-scd-p2, etc. (continuing the v1.5.0-ai-ops tag series)"));
  out.push(bulletItem("All changes go through the pre-push guardrail (scripts/pre-push-check.sh) per DEPLOYMENT_WORKFLOW.md"));

  out.push(h2("8.4 Sequencing dependencies"));
  out.push(bodyPara(
    "Phases are designed to be independent, but there are two soft dependencies to be aware of:"
  ));
  out.push(bulletItem("P4 (export) benefits from P2 (reason capture) \u2014 the exported PDF/Excel includes reason codes, so shipping P2 first makes P4's output richer. However, P4 can ship first with reasons omitted and add them when P2 lands."));
  out.push(bulletItem("P5 (reminders) links to past SCD history detail (P4). If P5 ships first, the reminder deep-links to the SCD hub instead of the history detail \u2014 a minor UX downgrade but not a blocker."));
  out.push(calloutPara(
    "Recommended order: P1 \u2192 P2 \u2192 P3 \u2192 P4 \u2192 P5. This maximises user-impact-per-session and lets each phase build on the previous one's data model.",
    P.aiAccent
  ));

  out.push(h2("8.5 Estimated total effort"));
  out.push(tableCaption("Table 11: Effort estimate per phase (in implementation sessions)"));
  out.push(makeTable(
    ["Phase", "Sessions", "Notes"],
    [
      ["P1", "1", "UI-only, no schema change"],
      ["P2", "1", "Small schema addition + dialog component"],
      ["P3", "2", "Largest phase: snapshot table + scan-to-assign logic + manual-add dialog"],
      ["P4", "1", "Two export endpoints + history-detail screen"],
      ["P5", "1", "Cron job + notification rendering"],
      [{ text: "Total", bold: true, fill: P.surface }, { text: "6 sessions", bold: true, fill: P.surface }, { text: "Approx 1\u20132 weeks of part-time work", fill: P.surface }],
    ],
    [15, 20, 65]
  ));

  return out;
}

module.exports = { buildBody, phaseOverviewTable };
