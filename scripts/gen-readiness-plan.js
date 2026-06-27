// Generate InventoryOS Production Readiness Plan as DOCX
const docx = require("docx");
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, Footer, Header,
  PageNumber, NumberFormat, Tab, TabStopType, TabStopPosition,
} = docx;

// Color palette
const PRIMARY = "1A56DB";
const DARK = "0F172A";
const MUTED = "64748B";
const ACCENT = "F59E0B";
const RED = "DC2626";
const GREEN = "059669";
const LIGHT_BG = "F1F5F9";

// Helper: heading paragraph
function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: PRIMARY })],
  });
}

// Helper: body paragraph
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 312 },
    children: [new TextRun({ text, size: 22, color: DARK, ...opts })],
  });
}

// Helper: bullet
function bullet(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 312 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: "• ", size: 22, color: PRIMARY, bold: true }),
      new TextRun({ text, size: 22, color: DARK, ...opts }),
    ],
  });
}

// Helper: numbered item
function numbered(num, text, opts = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 312 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: `${num}. `, size: 22, color: PRIMARY, bold: true }),
      new TextRun({ text, size: 22, color: DARK, ...opts }),
    ],
  });
}

// Helper: table cell
function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { line: 276 },
      children: [new TextRun({
        text,
        size: opts.size || 20,
        bold: opts.bold || false,
        color: opts.color || DARK,
      })],
    })],
  });
}

// Helper: table row
function row(cells, opts = {}) {
  return new TableRow({
    tableHeader: opts.header || false,
    cantSplit: true,
    children: cells,
  });
}

// ── BUILD DOCUMENT ──

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "InventoryOS — Production Readiness Plan", size: 16, color: MUTED, italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 16, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
          ],
        })],
      }),
    },
    children: [
      // ── TITLE ──
      new Paragraph({
        spacing: { before: 600, after: 100 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "InventoryOS", size: 56, bold: true, color: PRIMARY })],
      }),
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Production Readiness & Issue Resolution Plan", size: 32, bold: true, color: DARK })],
      }),
      new Paragraph({
        spacing: { after: 400 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Complete roadmap to handle AI costs, 10K+ products, performance, and production deployment", size: 22, color: MUTED, italics: true })],
      }),

      // ── TABLE OF CONTENTS ──
      heading("Document Overview", HeadingLevel.HEADING_1),
      body("This document lists every issue identified during development and testing of InventoryOS, along with a phased plan to resolve each one before production launch. Issues are categorized by severity and grouped into implementation phases."),

      // ── ISSUE SUMMARY TABLE ──
      heading("Issue Summary", HeadingLevel.HEADING_1),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row([
            cell("#", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 5 }),
            cell("Issue", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 30 }),
            cell("Severity", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 12 }),
            cell("Phase", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 10 }),
            cell("Impact", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 43 }),
          ], { header: true }),
          row([cell("1"), cell("No AI rate limiting"), cell("CRITICAL", { color: RED, bold: true }), cell("P1"), cell("Users can spam AI calls, costing $50+/month per pharmacy")]),
          row([cell("2"), cell("AI Chat sends all products as context"), cell("CRITICAL", { color: RED, bold: true }), cell("P1"), cell("10K products = 200K tokens per message = $0.03/msg + 15s response")]),
          row([cell("3"), cell("SQLite cannot handle 10K+ products"), cell("CRITICAL", { color: RED, bold: true }), cell("P2"), cell("File locks, no concurrent reads, 5-15s query times after 6 months")]),
          row([cell("4"), cell("No caching layer"), cell("HIGH", { color: ACCENT, bold: true }), cell("P2"), cell("Every page reload re-computes stats, valuations, analytics")]),
          row([cell("5"), cell("No API authentication middleware"), cell("HIGH", { color: ACCENT, bold: true }), cell("P2"), cell("Anyone can call /api/businesses/[id]/products without a session")]),
          row([cell("6"), cell("No tiered pricing model"), cell("HIGH", { color: ACCENT, bold: true }), cell("P3"), cell("Cannot monetize AI features separately from core features")]),
          row([cell("7"), cell("No AI usage tracking"), cell("HIGH", { color: ACCENT, bold: true }), cell("P1"), cell("Cannot measure per-customer AI cost or enforce limits")]),
          row([cell("8"), cell("No background jobs / cron"), cell("MEDIUM", { color: PRIMARY, bold: true }), cell("P3"), cell("Stats computed on-demand instead of pre-calculated nightly")]),
          row([cell("9"), cell("No error monitoring"), cell("MEDIUM", { color: PRIMARY, bold: true }), cell("P4"), cell("Silent failures in production with no alerting")]),
          row([cell("10"), cell("No backup automation"), cell("MEDIUM", { color: PRIMARY, bold: true }), cell("P4"), cell("Database loss = total business data loss")]),
          row([cell("11"), cell("Bangla language costs 2-3x tokens"), cell("LOW", { color: GREEN, bold: true }), cell("P4"), cell("Bangla Unicode uses more tokens, increasing AI cost")]),
          row([cell("12"), cell("No voice command support"), cell("LOW", { color: GREEN, bold: true }), cell("P5"), cell("Pharmacy staff may prefer voice over typing")]),
          row([cell("13"), cell("No production deployment setup"), cell("HIGH", { color: ACCENT, bold: true }), cell("P3"), cell("No Docker, no BDIX VPS config, no CI/CD")]),
          row([cell("14"), cell("Inventory valuation slow with large data"), cell("MEDIUM", { color: PRIMARY, bold: true }), cell("P2"), cell("Scans all batches on every request")]),
        ],
      }),

      // ── PHASE 1: AI COST CONTROL ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Phase 1: AI Cost Control & Abuse Prevention", HeadingLevel.HEADING_1),
      body("Goal: Cap AI costs at under 50 BDT/month per pharmacy and prevent abuse.", { bold: true }),
      body("Estimated time: 3-4 days"),
      body(""),

      heading("1.1 AI Usage Tracking Table", HeadingLevel.HEADING_2),
      body("Create an ai_usage table to track every AI call per business:"),
      bullet("Fields: businessId, feature (insights/chat/expiry-optimizer/product-assistant), tokensUsed, costEstimate, createdAt"),
      bullet("Increment on every AI API call"),
      bullet("Aggregate daily/monthly per business"),

      heading("1.2 Rate Limiting Middleware", HeadingLevel.HEADING_2),
      body("Add middleware to all /ai/ routes:"),
      bullet("Daily cap: 50 AI calls/business/day (hard limit)"),
      bullet("Hourly cap: 10 AI calls/business/hour"),
      bullet("Token budget: 500K tokens/month per business"),
      bullet("Return 429 Too Many Requests when exceeded"),
      bullet("Show remaining quota in AI UI components"),

      heading("1.3 AI Chat Context Optimization", HeadingLevel.HEADING_2),
      body("Instead of sending all products, send only relevant data:"),
      numbered(1, "Parse user query for keywords (product names, categories, numbers)"),
      numbered(2, "Fetch only matching products + summary stats (totals, counts)"),
      numbered(3, "Limit context to top 20 most relevant items"),
      numbered(4, "Send summary stats (totalProducts, lowStock, todaySales) as numbers, not arrays"),
      numbered(5, "Expected result: 200K tokens → 2K tokens per chat message (100x reduction)"),

      heading("1.4 AI Insights Caching", HeadingLevel.HEADING_2),
      body("Cache AI Insights results for 12 hours:"),
      bullet("Store last insights result + timestamp in database"),
      bullet("If data hasn't changed (no new sales/purchases), return cached result"),
      bullet("Add 'Regenerate' button in UI to force refresh"),
      bullet("Expected result: 30 calls/month → 5 calls/month (83% reduction)"),

      heading("1.5 Model Selection Strategy", HeadingLevel.HEADING_2),
      body("Use different LLM models for different features:"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row([cell("Feature", { bold: true, bg: LIGHT_BG }), cell("Model", { bold: true, bg: LIGHT_BG }), cell("Reason", { bold: true, bg: LIGHT_BG })], { header: true }),
          row([cell("AI Chat"), cell("GPT-4o-mini / Gemini Flash"), cell("Fast, cheap, good enough for Q&A")]),
          row([cell("AI Insights"), cell("GPT-4o-mini"), cell("Needs reasoning but not complex")]),
          row([cell("Expiry Optimizer"), cell("GPT-4o-mini"), cell("Structured analysis, not creative")]),
          row([cell("Product Assistant"), cell("GPT-4o-mini"), cell("Factual lookups")]),
          row([cell("Smart Reorder"), cell("None (algorithm)"), cell("No LLM needed")]),
          row([cell("Demand Forecast"), cell("None (algorithm)"), cell("No LLM needed")]),
        ],
      }),

      body(""),
      body("Expected monthly cost after P1: ~15 BDT/month per pharmacy (from ~150 BDT/month unoptimized)", { bold: true, color: GREEN }),

      // ── PHASE 2: DATABASE & PERFORMANCE ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Phase 2: Database Migration & Performance", HeadingLevel.HEADING_1),
      body("Goal: Handle 10K+ products with sub-1-second response times.", { bold: true }),
      body("Estimated time: 4-5 days"),
      body(""),

      heading("2.1 Migrate SQLite to PostgreSQL", HeadingLevel.HEADING_2),
      body("This is the single most critical performance fix:"),
      numbered(1, "Install PostgreSQL on BDIX VPS (80GB disk)"),
      numbered(2, "Update prisma/schema.prisma datasource to postgresql"),
      numbered(3, "Create migration script to transfer existing data"),
      numbered(4, "Test all API endpoints against PostgreSQL"),
      numbered(5, "Set up connection pooling (PgBouncer) for concurrent users"),
      body(""),
      body("Expected improvement: 10x faster queries, concurrent read support", { bold: true, color: GREEN }),

      heading("2.2 Add Database Indexes", HeadingLevel.HEADING_2),
      body("Verify and add missing indexes for common queries:"),
      bullet("Product: businessId + name (search), businessId + categoryId (filter)"),
      bullet("Sale: businessId + createdAt (date range), businessId + status + createdAt"),
      bullet("Batch: businessId + expiryDate + status (expiry queries)"),
      bullet("SaleItem: businessId + saleId (join), businessId + productId (product sales)"),
      bullet("Transaction: businessId + createdAt (audit log), businessId + type"),

      heading("2.3 Implement Caching Layer", HeadingLevel.HEADING_2),
      body("Add Redis (or in-memory cache) for expensive queries:"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row([cell("Query", { bold: true, bg: LIGHT_BG }), cell("Cache Duration", { bold: true, bg: LIGHT_BG }), cell("Trigger to Invalidate", { bold: true, bg: LIGHT_BG })], { header: true }),
          row([cell("Dashboard stats"), cell("5 minutes"), cell("New sale/purchase/return")]),
          row([cell("Inventory valuation"), cell("1 hour"), cell("New batch/purchase/adjustment")]),
          row([cell("Expiry stats"), cell("1 hour"), cell("New batch/status change")]),
          row([cell("Sales analytics"), cell("15 minutes"), cell("New sale/return")]),
          row([cell("Business dashboard"), cell("10 minutes"), cell("Any data change")]),
          row([cell("Product list (paginated)"), cell("2 minutes"), cell("New product/edit")]),
        ],
      }),

      heading("2.4 Optimize Slow Queries", HeadingLevel.HEADING_2),
      body("Queries that will be slow with 10K+ products:"),
      numbered(1, "Inventory valuation: Pre-compute nightly via cron job, store in cache table"),
      numbered(2, "Expiry stats: Pre-compute nightly, invalidate on batch changes"),
      numbered(3, "Sales analytics aggregation: Use SQL GROUP BY instead of JS reduce"),
      numbered(4, "Product search: Add full-text search index (PostgreSQL tsvector)"),
      numbered(5, "Transaction log: Ensure proper pagination (already done)"),

      heading("2.5 Background Job System", HeadingLevel.HEADING_2),
      body("Set up cron jobs for pre-computation:"),
      bullet("Every night 2AM: Compute inventory valuation, expiry stats, sales summary"),
      bullet("Every night 2:30AM: Run batch auto-sync (update near_expiry/expired statuses)"),
      bullet("Every night 3AM: Generate alert digest for daily email/SMS"),
      bullet("Every hour: Clear expired sessions"),
      bullet("Store results in a 'computed_stats' table for instant retrieval"),

      // ── PHASE 3: SECURITY & MONETIZATION ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Phase 3: Security, Authentication & Monetization", HeadingLevel.HEADING_1),
      body("Goal: Secure all APIs and implement tiered pricing.", { bold: true }),
      body("Estimated time: 3-4 days"),
      body(""),

      heading("3.1 API Authentication Middleware", HeadingLevel.HEADING_2),
      body("Currently anyone can call API routes without authentication. Fix:"),
      numbered(1, "Create middleware.ts at app root"),
      numbered(2, "Check for valid session token in Authorization header or cookie"),
      numbered(3, "Verify token belongs to the requested businessId"),
      numbered(4, "Return 401 Unauthorized if no valid session"),
      numbered(5, "Exempt only /api/auth/* routes (login, send-otp, verify-otp)"),

      heading("3.2 Tiered Pricing Model", HeadingLevel.HEADING_2),
      body("Add subscription tiers to the Business model:"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row([
            cell("Tier", { bold: true, bg: LIGHT_BG }),
            cell("Price (BDT/month)", { bold: true, bg: LIGHT_BG }),
            cell("Features", { bold: true, bg: LIGHT_BG }),
          ], { header: true }),
          row([cell("Free"), cell("0"), cell("Products, Sales, Batches, Basic Dashboard (max 100 products)")]),
          row([cell("Pro"), cell("500"), cell("Everything in Free + Reports, Analytics, Suppliers, Customers, Payments (unlimited products)")]),
          row([cell("Pro + AI"), cell("1,000"), cell("Everything in Pro + all 6 AI features with 50 calls/day limit")]),
        ],
      }),

      body(""),
      body("Implementation:"),
      bullet("Add 'subscriptionTier' field to Business model (free/pro/pro_ai)"),
      bullet("Add 'aiEnabled' boolean (toggled when customer pays for AI add-on)"),
      bullet("All /ai/ routes check aiEnabled flag first, return 403 if disabled"),
      bullet("AI UI components hidden when aiEnabled = false"),
      bullet("Free tier limited to 100 products (count check on product create)"),

      heading("3.3 Production Deployment Setup", HeadingLevel.HEADING_2),
      body("Prepare for BDIX VPS deployment:"),
      numbered(1, "Create Dockerfile for the Next.js app"),
      numbered(2, "Create docker-compose.yml with app + PostgreSQL + Redis"),
      numbered(3, "Create .env.production template"),
      numbered(4, "Set up Nginx reverse proxy with SSL"),
      numbered(5, "Create deployment script (build + push + restart)"),
      numbered(6, "Set up PM2 or systemd for process management"),

      // ── PHASE 4: MONITORING & RELIABILITY ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Phase 4: Monitoring, Backup & Reliability", HeadingLevel.HEADING_1),
      body("Goal: Ensure 99.5% uptime with automated monitoring and backups.", { bold: true }),
      body("Estimated time: 2-3 days"),
      body(""),

      heading("4.1 Error Monitoring", HeadingLevel.HEADING_2),
      bullet("Integrate Sentry (free tier: 5K errors/month) for automatic error capture"),
      bullet("Add try-catch logging to all API routes"),
      bullet("Create /api/health endpoint for uptime monitoring"),
      bullet("Set up UptimeRobot (free) to ping /api/health every 5 minutes"),

      heading("4.2 Automated Backups", HeadingLevel.HEADING_2),
      bullet("Daily PostgreSQL dump to /backups/ directory (cron at 1AM)"),
      bullet("Keep 7 daily backups + 4 weekly backups"),
      bullet("Upload weekly backup to cloud storage (Google Drive via rclone)"),
      bullet("Create restore script for disaster recovery"),
      bullet("Test restore process monthly"),

      heading("4.3 Bangla Language Optimization", HeadingLevel.HEADING_2),
      body("Bangla Unicode uses 2-3x more tokens than English. Mitigation:"),
      bullet("Translate common AI Chat responses to Bangla and cache them"),
      bullet("Use shorter system prompts in Bangla"),
      bullet("Offer Bangla/English toggle in AI Chat settings"),
      bullet("Monitor token usage per language and adjust rate limits"),

      heading("4.4 Performance Monitoring", HeadingLevel.HEADING_2),
      bullet("Add response time logging to all API routes"),
      bullet("Log slow queries (>1 second) to a separate file"),
      bullet("Create /api/admin/performance endpoint showing avg response times"),
      bullet("Set up alerts for response times > 3 seconds"),

      // ── PHASE 5: FUTURE ENHANCEMENTS ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Phase 5: Future Enhancements (Post-Launch)", HeadingLevel.HEADING_1),
      body("Goal: Add features that enhance UX but are not critical for launch.", { bold: true }),
      body("Estimated time: Ongoing after launch"),
      body(""),

      heading("5.1 Voice Command Support", HeadingLevel.HEADING_2),
      bullet("Use Z.AI ASR (Speech-to-Text) for voice input in AI Chat"),
      bullet("Use Z.AI TTS (Text-to-Speech) for voice output of AI responses"),
      bullet("Both support Bangla language"),
      bullet("Add microphone button in AI Chat input bar"),
      bullet("Estimated cost: +500-1000 tokens per voice message"),

      heading("5.2 Multi-Pharmacy Support", HeadingLevel.HEADING_2),
      bullet("One user managing multiple pharmacy branches"),
      bullet("Cross-branch inventory transfers"),
      bullet("Consolidated reporting across branches"),
      bullet("Per-branch user permissions"),

      heading("5.3 Mobile App (PWA)", HeadingLevel.HEADING_2),
      bullet("Convert to Progressive Web App (installable on phone)"),
      bullet("Add offline support for critical operations (sales, stock checks)"),
      bullet("Push notifications for expiry alerts"),
      bullet("Barcode scanning via camera API"),

      heading("5.4 WhatsApp Integration", HeadingLevel.HEADING_2),
      bullet("Send invoices via WhatsApp to customers"),
      bullet("Receive reorder alerts via WhatsApp"),
      bullet("AI Chat via WhatsApp bot (using same AI Chat API)"),
      bullet("Daily sales summary via WhatsApp message"),

      heading("5.5 Government Compliance", HeadingLevel.HEADING_2),
      bullet("DGDA (Directorate General of Drug Administration) reporting"),
      bullet("Narcotics register maintenance"),
      bullet("Schedule X drug tracking"),
      bullet("Prescription digital logging"),

      // ── TIMELINE ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Implementation Timeline", HeadingLevel.HEADING_1),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row([
            cell("Phase", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 10 }),
            cell("Title", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 35 }),
            cell("Duration", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 15 }),
            cell("Priority", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 15 }),
            cell("Blocks Launch?", { bold: true, bg: PRIMARY, color: "FFFFFF", width: 25 }),
          ], { header: true }),
          row([cell("P1", { bold: true, color: RED }), cell("AI Cost Control & Abuse Prevention"), cell("3-4 days"), cell("CRITICAL"), cell("YES — without this, AI costs are uncontrolled")]),
          row([cell("P2", { bold: true, color: ACCENT }), cell("Database Migration & Performance"), cell("4-5 days"), cell("CRITICAL"), cell("YES — SQLite fails at 10K products")]),
          row([cell("P3", { bold: true, color: ACCENT }), cell("Security, Auth & Monetization"), cell("3-4 days"), cell("HIGH"), cell("YES — no auth = no security")]),
          row([cell("P4", { bold: true, color: PRIMARY }), cell("Monitoring & Backup"), cell("2-3 days"), cell("MEDIUM"), cell("NO — can launch, add after")]),
          row([cell("P5", { bold: true, color: GREEN }), cell("Future Enhancements"), cell("Ongoing"), cell("LOW"), cell("NO — post-launch features")]),
        ],
      }),

      body(""),
      body("Total estimated time to production-ready: 12-16 days (P1-P3)", { bold: true, size: 24, color: PRIMARY }),
      body("Total estimated time to fully hardened: 15-19 days (P1-P4)", { bold: true, size: 24, color: PRIMARY }),

      // ── COST PROJECTION ──
      heading("Cost Projection Per Pharmacy (Monthly)", HeadingLevel.HEADING_1),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row([
            cell("Item", { bold: true, bg: LIGHT_BG, width: 40 }),
            cell("Cost (BDT/month)", { bold: true, bg: LIGHT_BG, width: 30 }),
            cell("Notes", { bold: true, bg: LIGHT_BG, width: 30 }),
          ], { header: true }),
          row([cell("AI API calls (GPT-4o-mini)"), cell("15 BDT"), cell("50 calls/day, optimized context")]),
          row([cell("VPS hosting (shared, 1/10th of server)"), cell("100 BDT"), cell("BDIX VPS, 80GB, shared")]),
          row([cell("Domain + SSL"), cell("10 BDT"), cell("Annual cost / 12")]),
          row([cell("Backup storage"), cell("5 BDT"), cell("Google Drive free tier")]),
          row([cell("Error monitoring (Sentry free)"), cell("0 BDT"), cell("Free tier sufficient")]),
          row([cell("SMS/Email alerts (future)"), cell("50 BDT"), cell("Only if SMS enabled")]),
          row([cell("", { bg: LIGHT_BG }), cell("", { bg: LIGHT_BG }), cell("", { bg: LIGHT_BG })]),
          row([cell("Total cost per pharmacy", { bold: true }), cell("180 BDT", { bold: true, color: RED }), cell("")]),
          row([cell("Revenue (Pro + AI tier)", { bold: true }), cell("1,000 BDT", { bold: true, color: GREEN }), cell("")]),
          row([cell("PROFIT per pharmacy", { bold: true, bg: LIGHT_BG }), cell("820 BDT", { bold: true, color: GREEN, bg: LIGHT_BG }), cell("82% margin")]),
        ],
      }),

      body(""),
      body("At 100 pharmacies: 82,000 BDT/month profit", { bold: true, color: GREEN }),
      body("At 500 pharmacies: 410,000 BDT/month profit", { bold: true, color: GREEN }),

      // ── SIGN OFF ──
      new Paragraph({ children: [new PageBreak()] }),
      heading("Document Sign-Off", HeadingLevel.HEADING_1),
      body("This document was created as a comprehensive plan based on real testing and development experience with InventoryOS. All issues listed have been identified through actual implementation across 20 phases of development."),
      body(""),
      body("Document Version: 1.0"),
      body("Date: June 2026"),
      body("System: InventoryOS — Pharmacy Inventory Management System"),
      body("Phases Completed: 20 (Phases 0-8b)"),
      body("Total API Routes: 69+"),
      body("Total UI Components: 52+"),
      body("Total Prisma Models: 15"),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("/home/z/my-project/download/InventoryOS_Production_Readiness_Plan.docx", buffer);
  console.log("Document generated: InventoryOS_Production_Readiness_Plan.docx");
});
