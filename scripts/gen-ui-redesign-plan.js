// Generate InventoryOS UI/UX Redesign Plan as DOCX
// Output: /home/z/my-project/download/InventoryOS_UI_Redesign_Plan.docx
const docx = require("docx");
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, Footer, Header,
  PageNumber,
} = docx;

// ── Color palette ──
const PRIMARY = "10B981"; // emerald
const DARK = "0F172A";
const MUTED = "6B7280";
const ACCENT = "8B5CF6"; // purple
const BLUE = "3B82F6";
const AMBER = "F59E0B";
const ROSE = "F43F5E";
const LIGHT_BG = "F1F5F9";
const GREEN = "059669";
const DONE_BG = "DCFCE7";
const WHITE = "FFFFFF";
const SURFACE = "F8FAFB";

// ── Helper functions ──

// heading(text, level, color)
// level: 1 = H1 (32 half-pts), 2 = H2 (26 half-pts), 3 = H3 (24 half-pts)
function heading(text, level, color) {
  let lvl = HeadingLevel.HEADING_1;
  let size = 32;
  if (level === 2) { lvl = HeadingLevel.HEADING_2; size = 26; }
  if (level === 3) { lvl = HeadingLevel.HEADING_3; size = 24; }
  return new Paragraph({
    heading: lvl,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({
      text,
      bold: true,
      color: color || PRIMARY,
      size,
      font: "Calibri",
    })],
  });
}

// body(text, opts)
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 312 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({
      text,
      size: 22,
      color: opts.color || DARK,
      bold: opts.bold || false,
      italics: opts.italic || false,
      font: "Calibri",
    })],
  });
}

// bullet(text)
function bullet(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 312 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: "\u2022  ", size: 22, color: opts.bulletColor || PRIMARY, bold: true, font: "Calibri" }),
      new TextRun({ text, size: 22, color: opts.color || DARK, bold: opts.bold || false, font: "Calibri" }),
    ],
  });
}

// numbered(num, text)
function numbered(num, text, opts = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 312 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: `${num}. `, size: 22, color: opts.numColor || PRIMARY, bold: true, font: "Calibri" }),
      new TextRun({ text, size: 22, color: opts.color || DARK, bold: opts.bold || false, font: "Calibri" }),
    ],
  });
}

// checkbox(text)
function checkbox(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 312 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "\u2610  ", size: 22, color: MUTED, font: "Calibri" }),
      new TextRun({ text, size: 22, color: opts.color || DARK, bold: opts.bold || false, font: "Calibri" }),
    ],
  });
}

// cell(text, opts)
function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { line: 276 },
      children: [new TextRun({
        text: text == null ? "" : String(text),
        size: opts.size || 20,
        bold: opts.bold || false,
        italics: opts.italic || false,
        color: opts.color || DARK,
        font: "Calibri",
      })],
    })],
  });
}

// multiCell(lines, opts) — array of text lines => one cell with multiple paragraphs
function multiCell(lines, opts = {}) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const paras = arr.map((line, idx) => new Paragraph({
    spacing: { line: 276, before: idx === 0 ? 0 : 40, after: 0 },
    children: [new TextRun({
      text: line == null ? "" : String(line),
      size: opts.size || 20,
      bold: opts.bold || false,
      color: opts.color || DARK,
      font: "Calibri",
    })],
  }));
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: paras,
  });
}

// row(cells)
function row(cells, opts = {}) {
  return new TableRow({
    tableHeader: opts.header || false,
    cantSplit: true,
    children: cells,
  });
}

// pageBreak paragraph
function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

// Empty spacer paragraph
function spacer(size = 100) {
  return new Paragraph({ spacing: { before: size, after: size }, children: [] });
}

// ── Section 1: Cover & Vision ──
function section1Cover() {
  const out = [];
  // Big title block
  out.push(new Paragraph({ spacing: { before: 1200 }, children: [] }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160, line: 480 },
    children: [new TextRun({
      text: "InventoryOS UI/UX Redesign",
      size: 56, bold: true, color: PRIMARY, font: "Calibri",
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120, line: 360 },
    children: [new TextRun({
      text: "Master Plan \u2014 From Skeleton to Premium Pharmacy Experience",
      size: 28, bold: false, italics: true, color: ACCENT, font: "Calibri",
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({
      text: "June 2026   \u2022   Version 1.0",
      size: 22, color: MUTED, font: "Calibri",
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({
      text: "Prepared for Product, Design & Engineering \u2014 InventoryOS",
      size: 20, italics: true, color: MUTED, font: "Calibri",
    })],
  }));

  // Vision
  out.push(heading("Vision", 2, ACCENT));
  out.push(body(
    "Transform the current messy skeleton UI into a creative, premium, responsive, colorful pharmacy management experience that a class 8 student can understand. The product moves from \u201cfunctionally complete but visually flat\u201d to a polished, opinionated, mobile-first experience that delights pharmacy staff on phones, tablets, and desktops. AI features are promoted from hidden utilities into a first-class tab with a dedicated purple-gradient theme, making the platform\u2019s intelligence visible and inviting. Every screen must communicate in 3 seconds: what is this, what can I do here, and what should I do next."
  ));

  // 5 Design Principles
  out.push(heading("Design Principles", 2, PRIMARY));
  out.push(numbered(1, "Simple = Powerful \u2014 every screen should be understood in 3 seconds. If a class 8 student needs instructions, the screen is wrong.", { numColor: PRIMARY }));
  out.push(numbered(2, "AI Front and Center \u2014 AI features get a dedicated tab with a purple gradient theme so they are visually distinct from operational features.", { numColor: PRIMARY }));
  out.push(numbered(3, "No Private Data on Dashboard \u2014 no sales revenue, expenses, or profit visible on the main dashboard; only operational metrics (product counts, stock levels, expiry alerts). Financials live inside Reports.", { numColor: PRIMARY }));
  out.push(numbered(4, "Mobile-First Premium \u2014 designed for phone first, scales up to tablet and desktop. Bottom navigation on phones, sidebar on desktop.", { numColor: PRIMARY }));
  out.push(numbered(5, "English Only \u2014 all UI text in English. No Bangla in the interface (translation can be added later as a layer; the default product language is English).", { numColor: PRIMARY }));
  return out;
}

// ── Section 2: Design System Foundation ──
function section2DesignSystem() {
  const out = [];
  out.push(heading("Section 2 \u2014 Design System Foundation", 1, PRIMARY));
  out.push(body(
    "The redesign is anchored on a single, opinionated design system: emerald primary, purple AI accent, soft pharmacy shadows, glass morphism surfaces, and a small set of reusable animations. Every component in the application pulls tokens from this system so that visual consistency is automatic and theming changes (light/dark, brand color tweaks) propagate everywhere."
  ));

  // Color palette table
  out.push(heading("Color Palette", 2, ACCENT));
  out.push(body("Primary emerald carries the brand. Purple is reserved for AI features. Amber and rose signal warning and danger. Surface tones keep the canvas calm so colorful accents read as intentional.", { italic: true, color: MUTED }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        cell("Token", { bold: true, bg: PRIMARY, color: WHITE, width: 22 }),
        cell("Hex", { bold: true, bg: PRIMARY, color: WHITE, width: 22 }),
        cell("Usage", { bold: true, bg: PRIMARY, color: WHITE, width: 56 }),
      ], { header: true }),
      row([cell("Primary \u2014 Emerald", { bold: true, color: PRIMARY }), cell("#10B981"), cell("Brand color, active nav, primary buttons, success indicators (50\u2013950 shades)")]),
      row([cell("Secondary \u2014 Blue", { bold: true, color: BLUE }), cell("#3B82F6"), cell("Information accent, product cards, links")]),
      row([cell("Accent \u2014 Purple", { bold: true, color: ACCENT }), cell("#8B5CF6"), cell("AI features only \u2014 gradients, sparkle icons, AI tab glow")]),
      row([cell("Warning \u2014 Amber", { bold: true, color: AMBER }), cell("#F59E0B"), cell("Low stock, near expiry, attention badges")]),
      row([cell("Danger \u2014 Rose", { bold: true, color: ROSE }), cell("#F43F5E"), cell("Out of stock, expired, destructive actions")]),
      row([cell("Surface", { bold: true }), cell("#F8FAFB"), cell("App background behind cards")]),
      row([cell("Card", { bold: true }), cell("#FFFFFF"), cell("Card, dialog, sheet background")]),
      row([cell("Dark", { bold: true, color: DARK }), cell("#0F172A"), cell("Headings, primary text, dark mode base")]),
    ],
  }));
  out.push(spacer(60));

  // Custom shadows
  out.push(heading("Custom Pharmacy Shadows", 2, ACCENT));
  out.push(body("Shadows are tinted with emerald so cards feel related to the brand instead of floating on a generic gray."))
  out.push(bullet("pharmacy: 0 1px 3px rgba(6, 95, 70, 0.06) \u2014 default card shadow"));
  out.push(bullet("pharmacy-lg: 0 4px 12px rgba(6, 95, 70, 0.08) \u2014 hovered / elevated cards"));
  out.push(bullet("pharmacy-xl: 0 12px 32px rgba(6, 95, 70, 0.12) \u2014 dialogs, sheets, AI hero cards"));
  out.push(bullet("nav: 0 -2px 12px rgba(15, 23, 42, 0.06) \u2014 bottom navigation on mobile"));

  // Animations
  out.push(heading("Animation Library", 2, ACCENT));
  out.push(body("A tight set of keyframe animations gives the app a premium feel without being distracting."))
  out.push(bullet("pulse-soft: 2s infinite \u2014 used on health indicators, expiry status dots, AI sparkle"));
  out.push(bullet("float: 3s ease-in-out infinite \u2014 subtle vertical movement on hero illustrations"));
  out.push(bullet("slide-up: 0.5s cubic-bezier(0.16, 1, 0.3, 1) \u2014 content enters from below on page transition"));
  out.push(bullet("fade-in: 0.4s ease-out \u2014 default enter animation for lists and panels"));
  out.push(bullet("scale-in: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) \u2014 bounce-in for welcome banners, AI cards, success states"));

  // Typography
  out.push(heading("Typography", 2, ACCENT));
  out.push(bullet("Plus Jakarta Sans \u2014 headings, hero text, KPI numbers (geometric, modern, friendly)"));
  out.push(bullet("Inter \u2014 body copy, labels, table cells (optimized for screen legibility)"));
  out.push(bullet("Font sizes scale from 12px (caption) through 14/16/18/20/24/32/48/64px (display)"));
  out.push(bullet("Weights: 400 regular, 500 medium, 600 semibold, 700 bold"));

  // Border radius, glass, hover
  out.push(heading("Surfaces, Radius, Glass & Hover", 2, ACCENT));
  out.push(bullet("Border radius: xl = 1rem, 2xl = 1.5rem \u2014 used on all cards, dialogs, buttons"));
  out.push(bullet("Glass morphism: background rgba(255,255,255,0.8) + backdrop-filter blur(10px) \u2014 sticky headers, AI hero overlays"));
  out.push(bullet("Card hover: translateY(-2px) + shadow pharmacy-lg + border tint shift \u2014 feels tactile, not jumpy"));

  // GSAP patterns
  out.push(heading("GSAP Motion Patterns", 2, ACCENT));
  out.push(bullet("Page transitions: fade (0.4s) + slide-up (8px) via layout-level GSAP timeline"));
  out.push(bullet("Card stagger: 0.04s delay between each card in a grid \u2014 grids feel choreographed"));
  out.push(bullet("Welcome banner: scale-in (0.3s, bounce) + text fade (0.2s)"));
  out.push(bullet("Number count-up: 0.8s, ease-out, used on KPI cards and dashboard stats"));
  out.push(bullet("AI sparkle: continuous float + opacity pulse on AI tab icon to draw the eye"));

  // Bottom nav indicator
  out.push(heading("Bottom Nav Active Indicator", 2, ACCENT));
  out.push(bullet("24px wide, 3px tall pill, primary emerald color"));
  out.push(bullet("Positioned top-center of the active tab"));
  out.push(bullet("Animated via layoutId so it slides between tabs (framer-motion)"));
  out.push(bullet("AI tab gets a purple glow ring instead of the standard indicator, reinforcing the AI theme"));

  return out;
}

// ── Section 3: Navigation Architecture ──
function section3Navigation() {
  const out = [];
  out.push(heading("Section 3 \u2014 Navigation Architecture", 1, PRIMARY));
  out.push(body(
    "The application moves from a sprawling side menu to a clear 5-tab model: Home, Stock, Sell, AI (NEW), More. The AI tab takes the slot previously held by Reports \u2014 Reports now lives inside More and inside dedicated dashboards \u2014 because AI is the platform\u2019s key differentiator and deserves permanent real estate. A PharmacyShell component wraps every authenticated screen and switches between desktop sidebar and mobile bottom-nav automatically."
  ));

  out.push(heading("5-Tab Navigation", 2, ACCENT));
  out.push(bullet("Home \u2014 dashboard, welcome banner, operational metrics, quick actions, AI quick access"));
  out.push(bullet("Stock \u2014 inventory hub, products, batches, categories, CSV import, expiry management"));
  out.push(bullet("Sell \u2014 quick dispense (FEFO POS), sales list, sales analytics"));
  out.push(bullet("AI (NEW) \u2014 dedicated AI features hub with purple gradient theme and sparkle glow"));
  out.push(bullet("More \u2014 people, purchasing, reports, settings, subscription, admin"));

  out.push(heading("AI Tab Treatment", 2, ACCENT));
  out.push(bullet("Replaces the old \u201cReports\u201d tab position \u2014 same slot, radically different visual"));
  out.push(bullet("Purple gradient icon background with animated sparkle to draw attention"));
  out.push(bullet("Glow ring (purple) on active state instead of the default emerald indicator"));
  out.push(bullet("All AI routes are prefixed /ai/* and grouped under this tab"));

  out.push(heading("Desktop Sidebar (1024px+)", 2, ACCENT));
  out.push(bullet("240px fixed-width sidebar on the left"));
  out.push(bullet("Top: InventoryOS logo + business name"));
  out.push(bullet("Middle: nav items with active state (bg-pharmacy-50, text-gray-900, left border accent)"));
  out.push(bullet("Bottom: user footer (avatar, name, role, logout)"));
  out.push(bullet("Sidebar collapses to a bottom nav below 1024px (no hamburger drawer \u2014 simpler mental model)"));

  out.push(heading("Mobile Bottom Nav (<1024px)", 2, ACCENT));
  out.push(bullet("Fixed bottom navigation with 5 tabs evenly spaced"));
  out.push(bullet("Active indicator: 24px wide, 3px tall, primary emerald, top-center, animated slide"));
  out.push(bullet("AI tab keeps the purple glow ring on mobile too"));
  out.push(bullet("Safe-area padding for iOS notch + 56px height + 8px top padding"));

  out.push(heading("PharmacyShell Component", 2, ACCENT));
  out.push(bullet("Single layout component wraps every authenticated route"));
  out.push(bullet("Detects viewport (useMediaQuery) and renders sidebar OR bottom-nav"));
  out.push(bullet("Hosts the header (search, notifications, profile), main content slot, and footer nav"));
  out.push(bullet("Owns the GSAP page-transition timeline so every route change is animated consistently"));
  out.push(bullet("Handles online/offline indicator + global toast container + pull-to-refresh on mobile"));

  out.push(heading("Navigation Map \u2014 50+ Views \u2192 Tabs", 2, ACCENT));
  out.push(body("Every view in the application is reachable from exactly one of the five tabs. The More tab acts as a launcher for the long tail of management screens.", { italic: true, color: MUTED }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        cell("Tab", { bold: true, bg: PRIMARY, color: WHITE, width: 14 }),
        cell("Views", { bold: true, bg: PRIMARY, color: WHITE, width: 86 }),
      ], { header: true }),
      row([cell("Home", { bold: true, color: PRIMARY }), multiCell([
        "Dashboard, Welcome Banner, Stats Grid (3 cards), Quick Actions (4-grid), Inventory Health, Recent Stock Updates, AI Quick Access, Expiry Alerts Widget, Notification Dropdown",
      ])]),
      row([cell("Stock", { bold: true, color: AMBER }), multiCell([
        "InventoryHub, ProductList, ProductDetail (Overview/Batches/History tabs), ProductForm (add/edit), BatchForm, CategoryManager, CsvImport, ExpiryDashboard, ExpiryOptimizer, ExpiryReport, ExpiryAlertsWidget, ExpiryTimeline, Bulk Expiry Actions",
      ])]),
      row([cell("Sell", { bold: true, color: BLUE }), multiCell([
        "QuickDispense (3-tap POS), FEFO Batch Preview, Manual Override Modal, SalesList, SaleDetail (printable invoice), SalesAnalytics (trend/hours/top/payment), ReturnsFlow",
      ])]),
      row([cell("AI", { bold: true, color: ACCENT }), multiCell([
        "AIHub, AIInsights (health score gauge), AIChat (full-screen), SmartReorder, DemandForecast, ExpiryOptimizer (AI), ProductAssistant (Description/Interactions/Category/Dosage tabs)",
      ])]),
      row([cell("More", { bold: true, color: DARK }), multiCell([
        "MoreHub, CustomerManager, CustomerDetail, SupplierManager, SupplierDetail, PurchaseList, PurchaseForm, PurchaseDetail, PaymentManager, ReturnsManager, DiscountRulesManager, ReportsHub, BusinessDashboard, P&L Report, InventoryValuation, BusinessReportCenter, TaxReport, AuditTrail, DataExport, MoreHub sections (People, Purchasing, Operations, AI & Insights, Settings, Subscription), UserManagement, SessionManager, LoginActivity, AlertPreferences, NotificationCenter, SubscriptionStatus, CsvImport (admin), TransactionLog, ChangePasswordDialog, Landing Page, Auth (Phone/OTP/Business Discovery/Success)",
      ])]),
    ],
  }));
  return out;
}

// ── Section 4: Phase 1 \u2014 Dashboard Redesign ──
function section4Phase1Dashboard() {
  const out = [];
  out.push(heading("Section 4 \u2014 Phase 1: Dashboard Redesign (2 days)", 1, PRIMARY));
  out.push(body("The dashboard is the first thing every user sees. It must answer \u201cis my pharmacy OK right now?\u201d in one glance \u2014 with operational metrics only. No revenue, no expenses, no profit. Those numbers belong in Reports and Business Dashboard, gated behind a tap.", { bold: true }));

  out.push(heading("Welcome Banner", 2, ACCENT));
  out.push(bullet("Full-width gradient banner: pharmacy-600 \u2192 emerald-400, with a subtle pharmacy cross pattern overlay"));
  out.push(bullet("Greeting (\u201cGood morning, Dr. Rahman\u201d) + business name + system status badges (All systems operational / Syncing / Offline)"));
  out.push(bullet("Last-updated timestamp + manual refresh button (rotates on tap)"));
  out.push(bullet("GSAP scale-in (0.3s, bounce) on first paint, then settles"));

  out.push(heading("3-Card Stats Grid", 2, ACCENT));
  out.push(bullet("Total Products \u2014 blue accent left border, count-up animation on load"));
  out.push(bullet("Low Stock \u2014 amber accent left border, count + delta vs yesterday"));
  out.push(bullet("Expiring Soon (next 30 days) \u2014 rose accent left border, count + \u201cview all\u201d link"));
  out.push(bullet("Each card: card-hover effect (translateY -2px + pharmacy-lg shadow) + tap navigates to the relevant list filtered"));
  out.push(bullet("CRITICAL: NO sales revenue, NO expenses, NO profit. Only operational counts.", { bold: true, color: ROSE, bulletColor: ROSE }));

  out.push(heading("Quick Actions \u2014 4 Grid", 2, ACCENT));
  out.push(bullet("Add Product \u2014 emerald icon, navigates to ProductForm"));
  out.push(bullet("Restock \u2014 amber icon, navigates to BatchForm"));
  out.push(bullet("New Sale \u2014 blue icon, navigates to QuickDispense"));
  out.push(bullet("AI Insights \u2014 PURPLE gradient icon with sparkle, navigates to AI Insights (this is the dashboard\u2019s hook into the AI tab)", { color: ACCENT, bold: true }));

  out.push(heading("Inventory Health Card", 2, ACCENT));
  out.push(bullet("Card with pulse-soft animation on a green checkmark when healthy"));
  out.push(bullet("Status message: \u201cInventory is healthy\u201d or \u201c3 items need attention\u201d"));
  out.push(bullet("Tap drills into AI Insights for full diagnosis"));

  out.push(heading("Recent Stock Updates", 2, ACCENT));
  out.push(bullet("Scrollable list of the 8 most recent stock movements"));
  out.push(bullet("Each row: product name, batch, qty change (+/-), time, status badge"));
  out.push(bullet("Status badges: green = stocked, amber = low, rose = out of stock"));

  out.push(heading("AI Quick Access Card", 2, ACCENT));
  out.push(bullet("Purple gradient card with sparkle icon + \u201cAsk AI about your pharmacy\u201d tagline"));
  out.push(bullet("One-tap access to AI Chat (full-screen) \u2014 the dashboard\u2019s second hook into the AI tab"));
  out.push(bullet("Shows today\u2019s remaining AI quota as a small progress ring"));

  out.push(heading("GSAP & Motion", 2, ACCENT));
  out.push(bullet("On dashboard mount: stagger card animations 0.05s delay each"));
  out.push(bullet("Welcome banner: scale-in (0.3s bounce) + text fade"));
  out.push(bullet("Stat numbers: count-up 0.8s ease-out"));
  out.push(bullet("Refresh button: rotation 360\u00b0 on tap, 0.4s"));

  out.push(heading("Constraints", 2, ROSE));
  out.push(bullet("NO revenue, NO expenses, NO profit numbers visible anywhere on the dashboard", { color: ROSE, bold: true }));
  out.push(bullet("All metrics are operational: counts, stock levels, expiry windows, movement activity"));
  out.push(bullet("Financial metrics are gated behind Reports tab and Business Dashboard (in More)"));
  return out;
}

// ── Section 5: Phase 2 \u2014 Inventory & Products ──
function section5Phase2Inventory() {
  const out = [];
  out.push(heading("Section 5 \u2014 Phase 2: Inventory & Products (3 days)", 1, PRIMARY));
  out.push(body("The Stock tab is the operational heart of the pharmacy. It hosts the inventory hub, product list, product detail, batch management, categories, and CSV import. Every screen here is designed for fast lookup and confident data entry.", { bold: true }));

  out.push(heading("InventoryHub", 2, ACCENT));
  out.push(bullet("3 large colored icon cards as the entry point: Products (blue), Stock & Batches (orange), Expiry (red)"));
  out.push(bullet("Each card shows live count + delta arrow + tap navigation"));
  out.push(bullet("Below: quick links to CategoryManager, CsvImport, ExpiryDashboard"));

  out.push(heading("ProductList", 2, ACCENT));
  out.push(bullet("Sticky search bar with pharmacy shadow + barcode-scan button (mobile)"));
  out.push(bullet("Horizontal scrolling category tabs styled as pill buttons (active = emerald, inactive = gray)"));
  out.push(bullet("Product cards: gradient icon background (category-colored), name, SKU, stock count, status badge"));
  out.push(bullet("Status badges: green = in stock, amber = low, rose = out"));
  out.push(bullet("Empty state: illustrated bottle icon + \u201cNo products yet\u201d + Add Product CTA"));
  out.push(bullet("Infinite scroll on mobile, paginated table on desktop"));

  out.push(heading("ProductDetail", 2, ACCENT));
  out.push(bullet("Tabbed view: Overview, Batches, History"));
  out.push(bullet("Overview: hero card with gradient icon, name, category, SKU, current stock, sale price (no profit margin visible)"));
  out.push(bullet("Batches tab: table of batches with batch number, qty, expiry date, expiry countdown badge (green/amber/rose)"));
  out.push(bullet("History tab: timeline of stock movements + sales for this product"));

  out.push(heading("ProductForm", 2, ACCENT));
  out.push(bullet("Clean sectioned form: Basic Info, Pricing (cost + sale price, profit calculated and shown to staff only if role permits), Category, Storage"));
  out.push(bullet("AI category suggestion button: purple highlight, sparkle icon \u2014 types a few words, AI suggests category"));
  out.push(bullet("Inline validation with friendly messages, sticky bottom save bar on mobile"));

  out.push(heading("BatchForm", 2, ACCENT));
  out.push(bullet("Batch entry: batch number, quantity, manufacture date, expiry date, supplier"));
  out.push(bullet("Auto-status calculation preview: shows \u201cThis batch will be marked: Active / Near Expiry / Expired\u201d as user picks dates"));
  out.push(bullet("FEFO badge preview: \u201cThis batch will dispense first\u201d if expiry is earliest"));

  out.push(heading("CategoryManager", 2, ACCENT));
  out.push(bullet("Grid of category cards, each with an editable color swatch (color picker)"));
  out.push(bullet("Each card shows product count + total stock value (to staff with permission)"));
  out.push(bullet("Add category dialog: name + color + icon picker"));

  out.push(heading("CsvImport", 2, ACCENT));
  out.push(bullet("Drag-drop zone (desktop) + file picker button (mobile)"));
  out.push(bullet("Preview table after upload: shows first 10 rows, mapping confirmation, validation errors inline"));
  out.push(bullet("Progress bar during import, summary card with success/error counts at the end"));
  return out;
}

// ── Section 6: Phase 3 \u2014 POS & Sales ──
function section6Phase3POS() {
  const out = [];
  out.push(heading("Section 6 \u2014 Phase 3: POS & Sales (2 days)", 1, PRIMARY));
  out.push(body("The Sell tab is where money changes hands. QuickDispense is built for speed \u2014 a pharmacist should be able to dispense a product in under 10 seconds, with FEFO batches selected automatically and overridable only with a documented reason.", { bold: true }));

  out.push(heading("QuickDispense \u2014 3-Tap Flow", 2, ACCENT));
  out.push(numbered(1, "Search \u2014 type product name or scan barcode, see live results", { numColor: PRIMARY }));
  out.push(numbered(2, "Quantity \u2014 tap +/- or type, FEFO batch preview cards show which batches will be drawn down", { numColor: PRIMARY }));
  out.push(numbered(3, "Confirm \u2014 summary card (items, total) + gradient green \u201cComplete Sale\u201d button", { numColor: PRIMARY }));

  out.push(heading("FEFO Batch Preview Cards", 2, ACCENT));
  out.push(bullet("Inside the quantity step, show the exact batches that will be consumed (First Expiry, First Out)"));
  out.push(bullet("Each card: batch number, qty available, expiry date, expiry countdown badge"));
  out.push(bullet("Visual stacking reinforces \u201cthis batch first, then this one\u201d"));

  out.push(heading("Manual Override Modal (Gap 11)", 2, ACCENT));
  out.push(bullet("Pharmacist can override FEFO selection \u2014 e.g., dispense a later batch for a specific reason"));
  out.push(bullet("Modal requires a reason field (free text + quick-pick chips: \u201cCustomer request\u201d, \u201cBatch quarantined\u201d, \u201cStock error\u201d)"));
  out.push(bullet("Override is logged to audit trail with user, timestamp, reason"));
  out.push(bullet("Closes Gap 11 from the gap analysis: FEFO was enforced but not overridable"));

  out.push(heading("Gradient Complete Button", 2, ACCENT));
  out.push(bullet("Final \u201cComplete Sale\u201d button uses emerald gradient + shadow pharmacy-lg"));
  out.push(bullet("On tap: success animation (checkmark scale-in), haptic on mobile, navigates to printable SaleDetail"));

  out.push(heading("SalesList", 2, ACCENT));
  out.push(bullet("Invoice cards: invoice #, customer, total, time, payment status badge"));
  out.push(bullet("Payment badges: green = paid, amber = partial, rose = unpaid"));
  out.push(bullet("Filter chips: Today, 7 days, 30 days, Custom range"));
  out.push(bullet("Tap a card \u2192 SaleDetail"));

  out.push(heading("SaleDetail", 2, ACCENT));
  out.push(bullet("Printable invoice layout: business header (logo, name, address, license), invoice meta, item table, totals, payment section, footer"));
  out.push(bullet("Print button triggers browser print with a print-optimized CSS sheet"));
  out.push(bullet("Share via WhatsApp / copy link / download PDF (future enhancement)"));

  out.push(heading("SalesAnalytics", 2, ACCENT));
  out.push(bullet("Trend line chart \u2014 30-day sales count (no revenue on dashboard, but analytics shows revenue for staff with permission)"));
  out.push(bullet("Peak hours bar chart \u2014 sales by hour of day, helps staffing decisions"));
  out.push(bullet("Top products horizontal bar chart \u2014 top 10 by units sold"));
  out.push(bullet("Payment breakdown donut \u2014 cash / card / mobile / credit"));
  out.push(bullet("All charts use the colorful palette (emerald, blue, amber, purple) \u2014 no muted gray charts"));

  out.push(heading("GSAP & Motion", 2, ACCENT));
  out.push(bullet("Number count-up on sales analytics stat cards"));
  out.push(bullet("Sale success: checkmark scale-in (0.3s bounce) + confetti burst (subtle, 6 particles)"));
  out.push(bullet("Chart enter: bars/lines grow from baseline over 0.6s with stagger"));
  return out;
}

// ── Section 7: Phase 4 \u2014 AI Features Hub ──
function section7Phase4AIHub() {
  const out = [];
  out.push(heading("Section 7 \u2014 Phase 4: AI Features Hub (3 days) \u2014 KEY DIFFERENTIATOR", 1, ACCENT));
  out.push(body("The AI tab is the platform\u2019s signature. It promotes AI from a hidden utility into a first-class destination with its own visual language: purple gradients, sparkle icons, glow rings. Every AI feature lives behind this tab so users always know where intelligence lives.", { bold: true, color: ACCENT }));

  out.push(heading("AI Hub Page", 2, ACCENT));
  out.push(bullet("Hero card: full-width purple gradient + animated sparkle + tagline \u201cAI-Powered Pharmacy Intelligence\u201d", { color: ACCENT, bold: true }));
  out.push(bullet("Subtitle: \u201cInsights, predictions, and assistance \u2014 built for your pharmacy.\u201d"));
  out.push(bullet("Today\u2019s AI usage progress ring (calls used / daily limit)"));

  out.push(heading("6 AI Feature Cards Grid", 2, ACCENT));
  out.push(bullet("AI Insights \u2014 brain icon, emerald-to-purple gradient"));
  out.push(bullet("AI Chat \u2014 chat-bubble icon, blue-to-purple gradient"));
  out.push(bullet("Smart Reorder \u2014 shopping-cart icon, purple-to-pink gradient"));
  out.push(bullet("Demand Forecast \u2014 chart-line icon, indigo-to-purple gradient"));
  out.push(bullet("Expiry Optimizer \u2014 clock icon, rose-to-purple gradient"));
  out.push(bullet("Product Assistant \u2014 pill icon, emerald-to-blue gradient"));
  out.push(bullet("Each card: unique gradient icon, one-line description, \u201cLaunch\u201d button"));
  out.push(bullet("Cards stagger in on scroll (0.04s delay each) via GSAP"));

  out.push(heading("AI Insights", 2, ACCENT));
  out.push(bullet("Health score gauge: circular progress (0\u2013100) with color zones (rose <40, amber 40\u201370, emerald >70)"));
  out.push(bullet("Insight cards with type colors: operational (blue), financial (emerald), risk (rose), opportunity (amber)"));
  out.push(bullet("Recommendations section with priority badges: CRITICAL (rose), HIGH (amber), MEDIUM (blue), LOW (gray)"));
  out.push(bullet("\u201cRegenerate\u201d button forces a fresh AI call (respects rate limit + cooldown)"));

  out.push(heading("AI Chat", 2, ACCENT));
  out.push(bullet("Full-screen chat experience with sticky header (back + title + usage)"));
  out.push(bullet("Bot avatar: purple gradient circle with sparkle icon"));
  out.push(bullet("Message bubbles: user (emerald, right), bot (white card with pharmacy shadow, left)"));
  out.push(bullet("Suggested question chips above the input: \u201cWhat\u2019s low?\u201d, \u201cWhat\u2019s expiring?\u201d, \u201cBest seller today?\u201d"));
  out.push(bullet("Typing indicator: 3 dots bouncing in a bot bubble"));
  out.push(bullet("Burst cooldown banner: if user sends 5+ messages in 60s, show \u201cSlowing down to save tokens \u2014 try again in 30s\u201d"));

  out.push(heading("Smart Reorder", 2, ACCENT));
  out.push(bullet("Urgency-sorted suggestion cards: critical (red), high (orange), medium (blue), low (gray)"));
  out.push(bullet("Each card: product, suggested qty, current stock, velocity (units/week), last sold"));
  out.push(bullet("Tap card \u2192 pre-fills a PurchaseForm with the suggested qty"));
  out.push(bullet("Velocity data shown as a small sparkline so pharmacists trust the recommendation"));

  out.push(heading("Demand Forecast", 2, ACCENT));
  out.push(bullet("90-day trend chart per product (historical + forecast band)"));
  out.push(bullet("Product forecast cards: predicted units, confidence indicator (high/medium/low), suggested stock-up qty"));
  out.push(bullet("Confidence shown as a small 3-dot indicator (3 = high, 2 = medium, 1 = low)"));

  out.push(heading("Expiry Optimizer (AI)", 2, ACCENT));
  out.push(bullet("Action recommendation cards with reason + estimated recovery amount"));
  out.push(bullet("Action colors: sell_priority (green), discount (amber), return (blue), donate (purple), dispose (rose)"));
  out.push(bullet("Each card: product, batch, expiry, suggested action, reason, estimated recovery value"));

  out.push(heading("Product Assistant", 2, ACCENT));
  out.push(bullet("Tabbed interface: Description, Interactions, Category, Dosage"));
  out.push(bullet("Each tab has an \u201cAI Generate\u201d button (purple) that calls the AI to fill the field"));
  out.push(bullet("Generated content is editable and saved to the product record"));
  out.push(bullet("Interactions tab shows drug-drug and drug-allergy warnings as colored chips"));

  out.push(heading("AI Theme Consistency", 2, ACCENT));
  out.push(bullet("ALL AI features use the purple gradient theme to distinguish from regular features", { bold: true, color: ACCENT }));
  out.push(bullet("Regular features = emerald/blue/amber/rose operational palette"));
  out.push(bullet("AI features = purple gradient + sparkle motif + glow rings"));
  out.push(bullet("This visual contract is enforced via a shared <AICard> / <AIButton> component family"));
  return out;
}

// ── Section 8: Phase 5 \u2014 Expiry Management ──
function section8Phase5Expiry() {
  const out = [];
  out.push(heading("Section 8 \u2014 Phase 5: Expiry Management (2 days)", 1, PRIMARY));
  out.push(body("Expiry is one of the highest-stakes operational concerns for a pharmacy \u2014 expired medicine cannot be sold and near-expiry batches need active management. This phase gives expiry its own dashboard, AI optimizer, printable report, and a compact widget for the main dashboard.", { bold: true }));

  out.push(heading("ExpiryDashboard", 2, ACCENT));
  out.push(bullet("4-card status grid: Active (green), Near Expiry (amber), Expired (rose), Quarantined (purple)"));
  out.push(bullet("Each card: count + tap to filter the batch table below"));
  out.push(bullet("13-week timeline chart: shows projected expiry counts per week for the next quarter"));
  out.push(bullet("Bulk action bar appears when batches are selected: Quarantine, Dispose, Return, Mark for Discount"));

  out.push(heading("ExpiryOptimizer (AI)", 2, ACCENT));
  out.push(bullet("AI-generated action recommendation cards \u2014 same component as the AI tab\u2019s expiry optimizer, surfaced here for operational convenience"));
  out.push(bullet("Each card: action (sell_priority/discount/return/donate/dispose), reason, estimated recovery"));
  out.push(bullet("\u201cApply\u201d button executes the action and logs to audit trail"));

  out.push(heading("ExpiryReport", 2, ACCENT));
  out.push(bullet("Printable layout: business header, summary box (total batches, near-expiry count, expired count, estimated value at risk)"));
  out.push(bullet("Batch details table: product, batch #, qty, expiry, days left, status, suggested action"));
  out.push(bullet("Print button + CSV download button"));

  out.push(heading("ExpiryAlertsWidget", 2, ACCENT));
  out.push(bullet("Compact widget for the main dashboard: 1-line summary (\u201c5 batches expiring in 30 days\u201d)"));
  out.push(bullet("Tap expands to a mini-list (top 3 urgent) with \u201cView all\u201d link to ExpiryDashboard"));

  out.push(heading("Pulse Animation on Status Indicators", 2, ACCENT));
  out.push(bullet("All expiry status dots use pulse-soft (2s infinite) to draw the eye"));
  out.push(bullet("Expired = solid rose + pulse, Near Expiry = solid amber + pulse, Quarantined = solid purple + pulse"));
  out.push(bullet("Active = static emerald (no pulse \u2014 healthy state is calm)"));
  return out;
}

// ── Section 9: Phase 6 \u2014 Reports & Analytics ──
function section9Phase6Reports() {
  const out = [];
  out.push(heading("Section 9 \u2014 Phase 6: Reports & Analytics (3 days)", 1, PRIMARY));
  out.push(body("The Reports module is where financial data lives \u2014 safely off the main dashboard. It includes business dashboard, P&L, inventory valuation, business report center, tax report, audit trail, and data export. All reports support CSV download and print.", { bold: true }));

  out.push(heading("ReportsHub", 2, ACCENT));
  out.push(bullet("3 sections with card navigation: Overview, Financial, Audit"));
  out.push(bullet("Overview: BusinessDashboard, InventoryValuation"));
  out.push(bullet("Financial: P&L Report, BusinessReportCenter, TaxReport"));
  out.push(bullet("Audit: AuditTrail, DataExport"));

  out.push(heading("BusinessDashboard", 2, ACCENT));
  out.push(bullet("4-column KPI grid with colored borders (revenue emerald, COGS blue, gross profit amber, expenses rose)"));
  out.push(bullet("7-day bar chart: daily revenue vs expenses"));
  out.push(bullet("Inventory valuation summary card + expiry risk grid"));
  out.push(bullet("Financial position snapshot (assets, liabilities, equity)"));

  out.push(heading("P&L Report", 2, ACCENT));
  out.push(bullet("Period selector: This Month, Last Month, This Quarter, This Year, Custom"));
  out.push(bullet("Revenue breakdown by category"));
  out.push(bullet("COGS section with category breakdown"));
  out.push(bullet("Gross profit hero card (large number + margin %)"));
  out.push(bullet("Expenses section + net profit footer"));
  out.push(bullet("Cash flow mini-chart at the bottom"));

  out.push(heading("InventoryValuation", 2, ACCENT));
  out.push(bullet("Summary cards: total stock value, total units, average turnover days"));
  out.push(bullet("Category breakdown with progress bars (share of total value)"));
  out.push(bullet("Product list with batch-level valuation drill-down"));

  out.push(heading("BusinessReportCenter", 2, ACCENT));
  out.push(bullet("Comprehensive printable report: covers operations + financials + risk + AI recommendations"));
  out.push(bullet("Used for monthly owner review \u2014 exports to PDF (via print)"));

  out.push(heading("TaxReport", 2, ACCENT));
  out.push(bullet("VAT compliance report with period selector"));
  out.push(bullet("Output VAT collected, Input VAT paid, Net VAT payable"));
  out.push(bullet("Printable + CSV \u2014 designed to match NBR (Bangladesh) format"));

  out.push(heading("AuditTrail", 2, ACCENT));
  out.push(bullet("Searchable table: timestamp, user, action type, entity, details"));
  out.push(bullet("Type badges: CREATE (green), UPDATE (blue), DELETE (rose), LOGIN (purple), AI (amber)"));
  out.push(bullet("User avatars + timestamps in relative format (\u201c2 hours ago\u201d)"));
  out.push(bullet("Filter by user, type, date range, entity"));

  out.push(heading("DataExport", 2, ACCENT));
  out.push(bullet("Format selector: JSON, CSV"));
  out.push(bullet("Module checkboxes: Products, Batches, Sales, Purchases, Customers, Suppliers, Transactions, Audit"));
  out.push(bullet("Generates a zip if multiple modules selected"));
  out.push(bullet("Large exports run as background jobs (Phase 0 of readiness plan)"));

  out.push(heading("Universal Export Support", 2, ACCENT));
  out.push(bullet("ALL reports support CSV download + print"));
  out.push(bullet("Print uses a dedicated print stylesheet (no nav, no shadows, B/W friendly)"));
  out.push(bullet("CSV uses UTF-8 with BOM for Excel compatibility"));
  return out;
}

// ── Section 10: Phase 7 \u2014 People & Purchasing ──
function section10Phase7People() {
  const out = [];
  out.push(heading("Section 10 \u2014 Phase 7: People & Purchasing (2 days)", 1, PRIMARY));
  out.push(body("The People & Purchasing surfaces cover customers, suppliers, purchases, payments, returns, and discount rules. These are reached from the More tab and are designed for occasional but confident use.", { bold: true }));

  out.push(heading("CustomerManager", 2, ACCENT));
  out.push(bullet("List with search + credit balance badges (green = no credit, amber = small, rose = large)"));
  out.push(bullet("Customer detail: contact info, credit balance, purchase history timeline"));
  out.push(bullet("Add / edit customer dialog with inline validation"));

  out.push(heading("SupplierManager", 2, ACCENT));
  out.push(bullet("List with balance badges (payable to supplier)"));
  out.push(bullet("Supplier detail: contact, balance, purchase history, payment history"));

  out.push(heading("PurchaseList / Form / Detail", 2, ACCENT));
  out.push(bullet("PurchaseList: cards with supplier, total, status badges (draft/received/partial/returned)"));
  out.push(bullet("PurchaseForm: supplier picker, line items with auto-fill from product search, batch entry per line"));
  out.push(bullet("Auto-batch creation: when a purchase is received, batches are created automatically from line items"));
  out.push(bullet("PurchaseDetail: item table + status timeline + linked payments"));

  out.push(heading("PaymentManager", 2, ACCENT));
  out.push(bullet("Record payment modal with method selector: Cash, Card, Mobile (bKash/Nagad/Rocket), Bank, Credit"));
  out.push(bullet("Payment list with filters + stats card (total paid this month)"));

  out.push(heading("ReturnsManager", 2, ACCENT));
  out.push(bullet("Process return flow: select sale, select items, enter reason, refund calculation"));
  out.push(bullet("Refund calculation: original total, returned items value, refund amount"));
  out.push(bullet("Returns list with status badges + linked original sale"));

  out.push(heading("DiscountRulesManager", 2, ACCENT));
  out.push(bullet("Rule cards with condition chips (\u201cCategory = Pain Relief\u201d, \u201cQty > 10\u201d, \u201cDay = Friday\u201d)"));
  out.push(bullet("Each card: rule name, discount type (% or fixed), value, active toggle"));
  out.push(bullet("Add / edit rule dialog with visual condition builder"));
  return out;
}

// ── Section 11: Phase 8 \u2014 Settings & Administration ──
function section11Phase8Settings() {
  const out = [];
  out.push(heading("Section 11 \u2014 Phase 8: Settings & Administration (2 days)", 1, PRIMARY));
  out.push(body("The More tab is the launcher for everything that isn\u2019t Home / Stock / Sell / AI. It hosts profile, grouped management sections, RBAC, alerts, notifications, subscription, and the long tail of admin screens.", { bold: true }));

  out.push(heading("MoreHub", 2, ACCENT));
  out.push(bullet("Top: profile card (avatar, name, role, business name)"));
  out.push(bullet("Grouped sections: People, Purchasing, Operations, AI & Insights, Settings, Subscription"));
  out.push(bullet("Each section is a card with navigation chevrons \u2014 tap to expand or navigate"));

  out.push(heading("UserManagement (RBAC)", 2, ACCENT));
  out.push(bullet("User cards with role badges (Owner emerald, Manager blue, Staff gray, Accountant amber)"));
  out.push(bullet("Add / edit user dialog with role picker"));
  out.push(bullet("Permission toggle grid: matrix of modules \u00d7 actions (view/create/edit/delete)"));

  out.push(heading("SessionManager", 2, ACCENT));
  out.push(bullet("Active sessions list with device info (browser, OS, location, last active)"));
  out.push(bullet("\u201cRevoke\u201d button per session + \u201cRevoke all other sessions\u201d button"));

  out.push(heading("LoginActivity", 2, ACCENT));
  out.push(bullet("Login history table: timestamp, user, IP, device, status (success/failed)"));
  out.push(bullet("Filter by user + date range"));

  out.push(heading("AlertPreferences", 2, ACCENT));
  out.push(bullet("Threshold sliders: low stock qty, near-expiry days, large-credit amount"));
  out.push(bullet("Notification toggles: email, SMS, push (per alert type)"));

  out.push(heading("NotificationCenter", 2, ACCENT));
  out.push(bullet("Bell icon in header with unread count badge"));
  out.push(bullet("Dropdown with grouped notifications (Today, Yesterday, Earlier)"));
  out.push(bullet("Mark-as-read on tap + \u201cMark all read\u201d button"));

  out.push(heading("SubscriptionStatus", 2, ACCENT));
  out.push(bullet("Tier card: current tier (Free / Pro / Pro+AI), renewal date, price"));
  out.push(bullet("Usage progress bars: products / AI calls / storage against tier limits"));
  out.push(bullet("Feature comparison table: Free vs Pro vs Pro+AI"));
  out.push(bullet("AI usage stats: calls this month, tokens used, estimated cost"));

  out.push(heading("Long Tail Admin Screens", 2, ACCENT));
  out.push(bullet("CsvImport (admin) \u2014 re-uses the Stock tab\u2019s import component"));
  out.push(bullet("DataExport \u2014 re-uses the Reports module\u2019s export"));
  out.push(bullet("AuditTrail \u2014 re-uses the Reports module\u2019s audit table"));
  out.push(bullet("TransactionLog \u2014 chronological log of all financial transactions"));
  out.push(bullet("CategoryManager \u2014 re-uses the Stock tab\u2019s category manager"));
  out.push(bullet("ChangePasswordDialog \u2014 modal with current + new + confirm fields + strength meter"));
  return out;
}

// ── Section 12: Phase 9 \u2014 Landing & Auth Flow ──
function section12Phase9LandingAuth() {
  const out = [];
  out.push(heading("Section 12 \u2014 Phase 9: Landing & Auth Flow (1 day)", 1, PRIMARY));
  out.push(body("The landing page is the marketing front door; the auth flow is the first product experience. Both should feel premium, fast, and reassuring.", { bold: true }));

  out.push(heading("Landing Page", 2, ACCENT));
  out.push(bullet("Hero section: emerald gradient background + animated pharmacy illustration (float animation) + typewriter headline"));
  out.push(bullet("6 feature cards: Inventory, Sales, Expiry, AI, Reports, Multi-Pharmacy \u2014 each with gradient icon"));
  out.push(bullet("Pricing tiers: Free, Pro (500 BDT/mo), Pro+AI (1000 BDT/mo) \u2014 tier cards with feature lists"));
  out.push(bullet("CTA: \u201cStart free \u2014 no credit card\u201d + secondary \u201cBook a demo\u201d"));
  out.push(bullet("Footer: links, contact, social"));

  out.push(heading("Auth Flow", 2, ACCENT));
  out.push(bullet("Step 1 \u2014 Phone input: large phone field with +880 prefix, \u201cSend OTP\u201d button"));
  out.push(bullet("Step 2 \u2014 OTP: 4-digit auto-focus inputs, auto-advance, resend timer"));
  out.push(bullet("Step 3 \u2014 Business discovery: \u201cFind your pharmacy\u201d \u2014 search by name or create new"));
  out.push(bullet("Step 4 \u2014 Login: success animation (checkmark scale-in) then redirect to dashboard"));

  out.push(heading("Visual Treatment", 2, ACCENT));
  out.push(bullet("All auth screens: centered card on emerald gradient background"));
  out.push(bullet("Card uses glass morphism (rgba(255,255,255,0.9) + blur) for a premium feel"));
  out.push(bullet("Logo + tagline above the card, trust signals below (\u201cUsed by 50+ pharmacies in Dhaka\u201d)"));

  out.push(heading("GSAP & Motion", 2, ACCENT));
  out.push(bullet("Hero typewriter: GSAP TextPlugin types headline over 1.5s"));
  out.push(bullet("Feature stagger: cards fade-in + slide-up with 0.08s delay each"));
  out.push(bullet("Auth card scale-in: 0.3s bounce on each step transition"));
  out.push(bullet("Success animation: checkmark draws + scales + brief confetti"));
  return out;
}

// ── Section 13: Phase 10 \u2014 Micro-Interactions & Polish ──
function section13Phase10Polish() {
  const out = [];
  out.push(heading("Section 13 \u2014 Phase 10: Micro-Interactions & Polish (2 days)", 1, PRIMARY));
  out.push(body("The final phase is what separates a working app from a loved app. Every async view gets loading, error, and empty states. Every number animates. Every notification slides. Every tap responds.", { bold: true }));

  out.push(heading("Loading States", 2, ACCENT));
  out.push(bullet("Skeleton loaders with shimmer: gray blocks animate left-to-right to suggest loading content"));
  out.push(bullet("Branded spinner: emerald cross + pulse for short waits (<500ms)"));
  out.push(bullet("Skeleton matches the layout of the loaded content (cards, lists, tables)"));

  out.push(heading("Number Animations", 2, ACCENT));
  out.push(bullet("Count-up on all stat cards (0.8s, ease-out)"));
  out.push(bullet("Numbers re-animate on refresh, not just on mount"));

  out.push(heading("Pull-to-Refresh (Mobile)", 2, ACCENT));
  out.push(bullet("Native-feeling pull-to-refresh on all list views"));
  out.push(bullet("Branded spinner appears at 60px pull, releases on release"));

  out.push(heading("Toast Notifications", 2, ACCENT));
  out.push(bullet("Slide-in from top on mobile, bottom-right on desktop"));
  out.push(bullet("4 types: success (emerald), error (rose), warning (amber), info (blue)"));
  out.push(bullet("Auto-dismiss after 4s + manual dismiss on tap"));

  out.push(heading("Empty States", 2, ACCENT));
  out.push(bullet("Illustrated empty states for every list view (custom illustration per module)"));
  out.push(bullet("Each empty state: illustration + headline + subtext + primary CTA"));
  out.push(bullet("Example: \u201cNo products yet \u2014 Add your first product to get started\u201d + Add Product button"));

  out.push(heading("Error States", 2, ACCENT));
  out.push(bullet("Friendly error illustration + headline + \u201cTry again\u201d button"));
  out.push(bullet("Network errors distinguish from server errors (\u201cYou\u2019re offline\u201d vs \u201cSomething went wrong\u201d)"));
  out.push(bullet("Retry button re-runs the failed query"));

  out.push(heading("Success States", 2, ACCENT));
  out.push(bullet("Checkmark scale-in animation on every successful save / create / complete"));
  out.push(bullet("Haptic feedback on mobile (light impact) for success actions"));

  out.push(heading("Dark Mode (Optional)", 2, ACCENT));
  out.push(bullet("Toggle in settings, defaults to system preference"));
  out.push(bullet("Dark base: #0F172A, surfaces #1E293B / #334155, accents unchanged"));
  out.push(bullet("All components tested in both modes"));

  out.push(heading("Performance", 2, ACCENT));
  out.push(bullet("Lazy load all route components (next/dynamic)"));
  out.push(bullet("Prefetch likely-next routes on hover (desktop) / tap-down (mobile)"));
  out.push(bullet("Optimize images: WebP + responsive srcset + lazy load below the fold"));
  out.push(bullet("Code-split AI features separately (they pull in larger vendor chunks)"));
  out.push(bullet("Target Lighthouse > 90 on all primary routes"));
  return out;
}

// ── Section 14: Implementation Timeline (TABLE) ──
function section14Timeline() {
  const out = [];
  out.push(heading("Section 14 \u2014 Implementation Timeline", 1, PRIMARY));
  out.push(body("11 phases, ~23 working days total. Phase 0 (Design System) is CRITICAL and blocks all others \u2014 it must ship first. Phases 1\u20133 are HIGH priority and can run in parallel by different engineers once Phase 0 is done. Phase 4 (AI Hub) depends on Phase 1 (Dashboard) because the dashboard hosts AI quick-access hooks. Phase 10 (Polish) depends on ALL prior phases."));
  out.push(spacer(40));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        cell("Phase #", { bold: true, bg: PRIMARY, color: WHITE, width: 10 }),
        cell("Title", { bold: true, bg: PRIMARY, color: WHITE, width: 32 }),
        cell("Duration", { bold: true, bg: PRIMARY, color: WHITE, width: 12 }),
        cell("Dependencies", { bold: true, bg: PRIMARY, color: WHITE, width: 24 }),
        cell("Priority", { bold: true, bg: PRIMARY, color: WHITE, width: 22 }),
      ], { header: true }),
      row([cell("Phase 0", { bold: true, color: ROSE }), cell("Design System Foundation"), cell("1 day"), cell("None"), cell("CRITICAL", { bold: true, color: ROSE })]),
      row([cell("Phase 1", { bold: true, color: AMBER }), cell("Dashboard Redesign"), cell("2 days"), cell("Phase 0"), cell("HIGH", { bold: true, color: AMBER })]),
      row([cell("Phase 2", { bold: true, color: AMBER }), cell("Inventory & Products"), cell("3 days"), cell("Phase 0"), cell("HIGH", { bold: true, color: AMBER })]),
      row([cell("Phase 3", { bold: true, color: AMBER }), cell("POS & Sales"), cell("2 days"), cell("Phase 0"), cell("HIGH", { bold: true, color: AMBER })]),
      row([cell("Phase 4", { bold: true, color: AMBER }), cell("AI Features Hub"), cell("3 days"), cell("Phase 1"), cell("HIGH", { bold: true, color: AMBER })]),
      row([cell("Phase 5", { bold: true, color: BLUE }), cell("Expiry Management"), cell("2 days"), cell("Phase 2"), cell("MEDIUM", { bold: true, color: BLUE })]),
      row([cell("Phase 6", { bold: true, color: BLUE }), cell("Reports & Analytics"), cell("3 days"), cell("Phase 0"), cell("MEDIUM", { bold: true, color: BLUE })]),
      row([cell("Phase 7", { bold: true, color: BLUE }), cell("People & Purchasing"), cell("2 days"), cell("Phase 0"), cell("MEDIUM", { bold: true, color: BLUE })]),
      row([cell("Phase 8", { bold: true, color: BLUE }), cell("Settings & Administration"), cell("2 days"), cell("Phase 0"), cell("MEDIUM", { bold: true, color: BLUE })]),
      row([cell("Phase 9", { bold: true, color: GREEN }), cell("Landing & Auth Flow"), cell("1 day"), cell("Phase 0"), cell("LOW", { bold: true, color: GREEN })]),
      row([cell("Phase 10", { bold: true, color: GREEN }), cell("Micro-Interactions & Polish"), cell("2 days"), cell("ALL"), cell("LOW", { bold: true, color: GREEN })]),
      row([
        cell("TOTAL", { bold: true, bg: DONE_BG, color: DARK }),
        cell("\u2248 23 working days", { bold: true, bg: DONE_BG, color: DARK }),
        cell("23 days", { bold: true, bg: DONE_BG, color: DARK }),
        cell("Sequential", { bg: DONE_BG, color: DARK }),
        cell("\u2014", { bg: DONE_BG, color: DARK }),
      ]),
    ],
  }));
  out.push(spacer(60));
  out.push(body("Critical path: Phase 0 \u2192 Phase 1 \u2192 Phase 4 (AI Hub). The AI Hub is the platform\u2019s signature feature, so unblocking Phase 4 quickly is the highest-leverage sequencing decision.", { italic: true, color: MUTED }));
  return out;
}

// ── Section 15: Feature Checklist (TABLE) ──
function section15Checklist() {
  const out = [];
  out.push(heading("Section 15 \u2014 Feature Checklist", 1, PRIMARY));
  out.push(body("Complete mapping of every feature in the application to its delivery phase. This is the contract: if a feature is not in this list, it is not in scope for the redesign."));
  out.push(spacer(40));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        cell("Module", { bold: true, bg: PRIMARY, color: WHITE, width: 22 }),
        cell("Features", { bold: true, bg: PRIMARY, color: WHITE, width: 58 }),
        cell("Phase", { bold: true, bg: PRIMARY, color: WHITE, width: 20 }),
      ], { header: true }),
      row([cell("Products", { bold: true, color: BLUE }), cell("list, detail, add, edit, CSV import, categories"), cell("Phase 2", { color: BLUE })]),
      row([cell("Batches", { bold: true, color: AMBER }), cell("list, add, edit, auto-sync, quarantine, dispose, return"), cell("Phase 2 + 5", { color: AMBER })]),
      row([cell("FEFO", { bold: true, color: BLUE }), cell("quick dispense, manual override with reason (Gap 11)"), cell("Phase 3", { color: BLUE })]),
      row([cell("Sales", { bold: true, color: BLUE }), cell("list, detail, POS, analytics, trends, peak hours"), cell("Phase 3", { color: BLUE })]),
      row([cell("Customers", { bold: true, color: DARK }), cell("list, detail, credit, add, edit"), cell("Phase 7", { color: DARK })]),
      row([cell("Suppliers", { bold: true, color: DARK }), cell("list, detail, balance, payments"), cell("Phase 7", { color: DARK })]),
      row([cell("Purchases", { bold: true, color: DARK }), cell("list, detail, form, returns"), cell("Phase 7", { color: DARK })]),
      row([cell("Payments", { bold: true, color: DARK }), cell("record, list, stats"), cell("Phase 7", { color: DARK })]),
      row([cell("Returns", { bold: true, color: DARK }), cell("process, list"), cell("Phase 7", { color: DARK })]),
      row([cell("Discount Rules", { bold: true, color: DARK }), cell("rule cards with conditions"), cell("Phase 7", { color: DARK })]),
      row([cell("Expiry", { bold: true, color: ROSE }), cell("dashboard, timeline, alerts, report, optimizer, bulk actions"), cell("Phase 5", { color: ROSE })]),
      row([cell("Reports", { bold: true, color: GREEN }), cell("P&L, valuation, business, tax, audit trail, data export"), cell("Phase 6", { color: GREEN })]),
      row([cell("Business Dashboard", { bold: true, color: GREEN }), cell("KPIs, charts, financial position"), cell("Phase 6", { color: GREEN })]),
      row([cell("AI", { bold: true, color: ACCENT }), cell("insights, chat, reorder, forecast, expiry optimizer, product assistant"), cell("Phase 4", { color: ACCENT })]),
      row([cell("RBAC", { bold: true, color: DARK }), cell("users, roles, permissions, sessions, login activity"), cell("Phase 8", { color: DARK })]),
      row([cell("Settings", { bold: true, color: DARK }), cell("profile, alerts, subscription, categories"), cell("Phase 8", { color: DARK })]),
      row([cell("Notifications", { bold: true, color: DARK }), cell("center, digest"), cell("Phase 8", { color: DARK })]),
      row([cell("Landing + Auth", { bold: true, color: GREEN }), cell("landing page, phone/OTP/business discovery auth flow"), cell("Phase 9", { color: GREEN })]),
      row([cell("Polish", { bold: true, color: GREEN }), cell("skeletons, toasts, empty/error/success states, dark mode, perf"), cell("Phase 10", { color: GREEN })]),
    ],
  }));
  return out;
}

// ── Section 16: Acceptance Criteria & Sign-Off ──
function section16Acceptance() {
  const out = [];
  out.push(heading("Section 16 \u2014 Acceptance Criteria & Sign-Off", 1, PRIMARY));
  out.push(body("The redesign is considered complete when every checkbox below is ticked. Sign-off requires both Product Owner and Engineering Lead."));
  out.push(spacer(40));

  out.push(heading("Acceptance Criteria", 2, ACCENT));
  out.push(checkbox("All 50+ views redesigned with premium look (no skeleton/placeholder UI remains)"));
  out.push(checkbox("Responsive on mobile (320px), tablet (768px), desktop (1024px+) \u2014 no horizontal scroll on any breakpoint"));
  out.push(checkbox("GSAP animations on all page transitions + card staggers (0.04s delay)"));
  out.push(checkbox("NO private financial data (revenue, expenses, profit) visible on the main dashboard"));
  out.push(checkbox("AI features highlighted with purple gradient theme + dedicated AI tab with sparkle glow"));
  out.push(checkbox("All UI text in English \u2014 no Bangla strings in the interface"));
  out.push(checkbox("Class 8 student can navigate the dashboard without instructions (validated via user test)"));
  out.push(checkbox("Loading, error, and empty states for all async views"));
  out.push(checkbox("Build passes with zero warnings (next build && next lint)"));
  out.push(checkbox("Lighthouse score > 90 on all primary routes (Home, Stock, Sell, AI, More)"));
  out.push(checkbox("CSV download + print supported on all reports"));
  out.push(checkbox("Audit trail captures all create/update/delete + FEFO manual overrides with reasons"));
  out.push(checkbox("Mobile bottom-nav active indicator animates between tabs (layoutId)"));
  out.push(checkbox("Dark mode works on all components (if implemented in Phase 10)"));
  out.push(spacer(60));

  out.push(heading("Sign-Off Block", 2, ACCENT));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        cell("Role", { bold: true, bg: PRIMARY, color: WHITE, width: 25 }),
        cell("Name", { bold: true, bg: PRIMARY, color: WHITE, width: 30 }),
        cell("Signature", { bold: true, bg: PRIMARY, color: WHITE, width: 30 }),
        cell("Date", { bold: true, bg: PRIMARY, color: WHITE, width: 15 }),
      ], { header: true }),
      row([
        cell("Product Owner", { bold: true }),
        cell(""),
        cell(""),
        cell(""),
      ]),
      row([
        cell("Engineering Lead", { bold: true }),
        cell(""),
        cell(""),
        cell(""),
      ]),
      row([
        cell("Design Lead", { bold: true }),
        cell(""),
        cell(""),
        cell(""),
      ]),
    ],
  }));
  out.push(spacer(80));
  out.push(body("Document Version: 1.0", { italic: true, color: MUTED }));
  out.push(body("Date: June 2026", { italic: true, color: MUTED }));
  out.push(body("System: InventoryOS \u2014 Pharmacy Inventory Management System", { italic: true, color: MUTED }));
  out.push(body("Total Views Redesigned: 50+  |  Total Phases: 11 (0\u201310)  |  Total Duration: \u2248 23 days", { italic: true, color: MUTED }));
  return out;
}

// ── Assemble document ──
function buildChildren() {
  const all = [];
  // Section 1 (no page break before)
  all.push(...section1Cover());
  // Sections 2-16 each start with a page break
  all.push(pb());
  all.push(...section2DesignSystem());
  all.push(pb());
  all.push(...section3Navigation());
  all.push(pb());
  all.push(...section4Phase1Dashboard());
  all.push(pb());
  all.push(...section5Phase2Inventory());
  all.push(pb());
  all.push(...section6Phase3POS());
  all.push(pb());
  all.push(...section7Phase4AIHub());
  all.push(pb());
  all.push(...section8Phase5Expiry());
  all.push(pb());
  all.push(...section9Phase6Reports());
  all.push(pb());
  all.push(...section10Phase7People());
  all.push(pb());
  all.push(...section11Phase8Settings());
  all.push(pb());
  all.push(...section12Phase9LandingAuth());
  all.push(pb());
  all.push(...section13Phase10Polish());
  all.push(pb());
  all.push(...section14Timeline());
  all.push(pb());
  all.push(...section15Checklist());
  all.push(pb());
  all.push(...section16Acceptance());
  return all;
}

const doc = new Document({
  creator: "InventoryOS",
  title: "InventoryOS UI/UX Redesign Plan",
  description: "Master Plan \u2014 From Skeleton to Premium Pharmacy Experience",
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22, color: DARK },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: "Calibri", size: 32, bold: true, color: PRIMARY },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
      heading2: {
        run: { font: "Calibri", size: 26, bold: true, color: ACCENT },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
      heading3: {
        run: { font: "Calibri", size: 24, bold: true, color: DARK },
        paragraph: { spacing: { before: 160, after: 80, line: 312 } },
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
          children: [new TextRun({
            text: "InventoryOS \u2014 UI/UX Redesign Plan",
            size: 18, color: MUTED, italics: true, font: "Calibri",
          })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 18, color: MUTED, font: "Calibri" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED, font: "Calibri" }),
            new TextRun({ text: " of ", size: 18, color: MUTED, font: "Calibri" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: MUTED, font: "Calibri" }),
          ],
        })],
      }),
    },
    children: buildChildren(),
  }],
});

// ── Write to disk ──
const OUT_PATH = "/home/z/my-project/download/InventoryOS_UI_Redesign_Plan.docx";
Packer.toBuffer(doc).then((buffer) => {
  // Ensure download directory exists
  const dir = path.dirname(OUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, buffer);
  const sizeKB = (buffer.length / 1024).toFixed(1);
  console.log(`\u2705 Document generated: ${OUT_PATH}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`   Sections: 16`);
  console.log(`   Pages: ~25-30 (with page breaks before each section)`);
}).catch((err) => {
  console.error("\u274c Failed to generate document:", err);
  process.exit(1);
});
