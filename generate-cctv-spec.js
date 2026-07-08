const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  TableOfContents, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, SectionType, TableLayoutType,
  LevelFormat, NumberFormat,
} = require("docx");

// ── Palette: GO-1 (Graphite Orange) — tech proposal ──
const P = {
  bg: "1A2330", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
  metaColor: "90989F", footerColor: "687078", accent: "D4875A",
};
const T = { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" };
const c = (hex) => hex.replace("#", "");

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Title helpers ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([' ', '-', '/', '(', ')', ':', ',']);
  const lines = []; let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 3) {
    const last = lines.pop(); lines[lines.length - 1] += last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, metaLineCount = 0, fixedHeight = 400 } = params;
  const SAFETY = 1200;
  const usableHeight = 16838 - 0 - 0 - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const contentHeight = titleHeight + subtitleHeight + metaHeight + fixedHeight + 900;
  const remainingSpace = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawBottom = Math.floor(remainingSpace * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(Math.floor(remainingSpace * 0.45) - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: 0, bottomSpacing };
}

// ── Cover R1 ──
function buildCoverR1(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel, size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, font: { ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor, font: { ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

// ── Body helpers ──
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: "1A2330", font: { ascii: "Times New Roman" } })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: "1A2330", font: { ascii: "Times New Roman" } })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "3A4A5A", font: { ascii: "Times New Roman" } })] });
}
function body(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { ascii: "Calibri" } })] });
}
function bodyNoIndent(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { ascii: "Calibri" } })] });
}
function boldBody(label, text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { line: 312, after: 120 },
    children: [
      new TextRun({ text: label, bold: true, size: 24, color: "000000", font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 24, color: "000000", font: { ascii: "Calibri" } }),
    ] });
}

function makeTable(headers, rows) {
  const hdrRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: T.headerBg },
      borders: { top: NB, bottom: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine }, left: NB, right: NB },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: h, bold: true, size: 21, color: T.headerText, font: { ascii: "Calibri" } })] })],
    })),
  });
  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map(cell => new TableCell({
      width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
      shading: idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: T.surface } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      borders: { top: NB, bottom: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine }, left: NB, right: NB },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: cell, size: 21, color: "000000", font: { ascii: "Calibri" } })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [hdrRow, ...dataRows],
  });
}

function tableCaption(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 },
    children: [new TextRun({ text, italics: true, size: 21, color: "506070", font: { ascii: "Calibri" } })] });
}

// ── Build document ──
const doc = new Document({
  styles: {
    default: { document: {
      run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: "000000" },
      paragraph: { spacing: { line: 312 } },
    }},
    heading1: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: "1A2330" } },
    heading2: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: "1A2330" } },
    heading3: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 26, bold: true, color: "3A4A5A" } },
  },
  numbering: {
    config: [{
      reference: "phase-list",
      levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "Phase %1", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 720 } }, run: { bold: true, size: 24 } } }],
    }],
  },
  sections: [
    // ── Section 1: Cover ──
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "InventoryOS CCTV & Electronics Shop Module: Implementation Plan",
        subtitle: "Multi-Vertical Expansion - Second Business Vertical",
        englishLabel: "INVENTORYOS  |  TECHNICAL SPECIFICATION",
        metaLines: [
          "Prepared for: InventoryOS Product Team",
          "Author: Sajid Chowdhury",
          "Date: July 2025",
          "Version: 1.0-DRAFT",
        ],
        footerLeft: "CONFIDENTIAL",
        footerRight: "InventoryOS by Sajid Chowdhury",
        palette: P,
      }),
    },

    // ── Section 2: TOC (Roman) ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["PAGE", " \\* ROMAN ", "\\* MERGEFORMAT"], size: 18, color: "808080", font: { ascii: "Calibri" } })] })] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: "1A2330", font: { ascii: "Times New Roman" } })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ spacing: { before: 200 },
          children: [new TextRun({ text: "Note: Right-click the TOC and select \"Update Field\" to refresh page numbers after editing.", italics: true, size: 18, color: "888888" })] }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ── Section 3: Body (Arabic) ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [new TextRun({ text: "InventoryOS CCTV Module Implementation Plan", size: 18, color: "808080", font: { ascii: "Calibri" } })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["PAGE", " \\* arabic ", "\\* MERGEFORMAT"], size: 18, color: "808080", font: { ascii: "Calibri" } })] })] }) },
      children: [
        // ═══════════════════════════════════════
        // 1. EXECUTIVE SUMMARY
        // ═══════════════════════════════════════
        h1("1. Executive Summary"),
        body("InventoryOS is a multi-tenant SaaS platform currently serving Bangladeshi retail pharmacies with a fully built module covering batch/expiry tracking, AI-powered features, a 9-tier AI cost-control defense system, and automated scheduled reports. The platform architecture is designed from the ground up to support multiple business verticals through a modular registry system. This document presents the comprehensive implementation plan for the second vertical: the CCTV and Electronics Retail Shop module."),
        body("The Bangladesh electronics retail and repair market has fundamentally different inventory requirements from pharmacies. While pharmaceutical inventory tracks products in bulk quantities with FEFO (First-Expiry-First-Out) logic, the electronics sector demands serialized asset tracking at the individual unit level. Each mobile phone, CCTV camera, NVR, or DVR must be uniquely identified by IMEI or serial number throughout its entire lifecycle: from procurement, through warehousing, sale, and post-sale warranty or repair service."),
        body("This plan divides the implementation into seven sequential phases, each containing carefully scoped sub-segments. The phases are ordered to maximize user value per development session and to ensure each phase's output feeds directly into the next. The estimated total effort spans 12 to 18 development sessions, with each phase producing a independently testable and deployable increment."),

        // ═══════════════════════════════════════
        // 2. CURRENT STATE & PROBLEM ANALYSIS
        // ═══════════════════════════════════════
        h1("2. Current State and Problem Analysis"),
        h2("2.1 Platform Architecture Overview"),
        body("InventoryOS runs as a single Next.js 16 application with App Router, TypeScript, Prisma 6 on PostgreSQL, and a mobile-first UI built with shadcn/ui and Tailwind CSS. Multi-tenancy is enforced at the API and Prisma query level by filtering every business-scoped route through businessId. The platform already supports authentication (phone-OTP + username/password), RBAC with six roles, subscription billing (Free/Pro/Pro AI tiers via bKash, Nagad, and SSL Commerz), a super-admin console, and a 9-tier AI cost-control defense system."),
        body("The module registry in src/lib/modules.ts currently lists seven business types: pharmacy (active), grocery, restaurant, cctv, mobile, electric, and bakery. The cctv entry already exists as a stub with isActive: false. Adding the CCTV vertical means setting it to active, creating the module folder at src/modules/cctv/, and building domain-specific schemas, services, components, and API routes that mirror the pharmacy module's structure while introducing entirely new domain concepts."),

        h2("2.2 Why Pharmacy Models Are Insufficient"),
        body("The pharmacy module was designed around bulk quantity management: a Product has an aggregate Inventory quantity, and individual Batch records track expiry dates. This model fundamentally cannot serve the electronics sector for three reasons. First, high-value items like smartphones and NVRs must be tracked individually by IMEI or serial number, not as an anonymous count. Second, the same physical device moves between states (in-stock, sold, in-repair, returned, under-warranty) that do not exist in pharmacy workflows. Third, electronics retail involves servicing and repair job cards with technician assignments, spare parts consumption, and commission calculations, none of which exist in the pharmacy domain."),
        body("Additionally, CCTV sales frequently involve project-based installation work requiring site surveys, storage estimation calculators, cable route planning, and Annual Maintenance Contracts (AMC) for corporate clients. These are entirely new business concepts that must be modeled from scratch. The POS requirements also differ: electronics shops need EMI (Equated Monthly Installment) support, Mobile Financial Services (bKash, Nagad, Rocket) integration, and Mushak 6.3 tax invoice generation for NBR compliance."),

        // ═══════════════════════════════════════
        // 3. GOALS & EXPECTED OUTCOMES
        // ═══════════════════════════════════════
        h1("3. Goals and Expected Outcomes"),
        h2("3.1 Primary Objectives"),
        makeTable(
          ["Objective", "Description", "Success Metric"],
          [
            ["Serialized Tracking", "Track every unit by IMEI/SN with full lifecycle history", "100% of high-value items tracked individually"],
            ["Servicing Management", "Complete job card lifecycle with spare parts and commissions", "Average repair TAT reduced by 30%"],
            ["CCTV Project Support", "Site surveys, storage estimation, and AMC management", "Zero manual calculation errors on storage quotes"],
            ["NBR Compliance", "Mushak 6.3 invoices, 6.1/6.2 registers, 9.1 returns", "100% auto-generated tax documents"],
            ["POS Modernization", "MFS payments, EMI management, loyalty points", "Support for 5+ payment methods"],
            ["AI Integration", "Demand forecasting, smart diagnostics, HDD health prediction", "AI features available for Pro AI tier"],
          ]
        ),
        tableCaption("Table 1: Primary Objectives and Success Metrics"),

        h2("3.2 Design Principles"),
        body("Reuse, Do Not Reinvent. Every piece of shared infrastructure, including authentication, RBAC, subscription gating, AI cost control, report scheduling, and the super-admin console, is reused from the existing platform. Only domain-specific logic is built new. Mobile-First. The primary user is a shop owner or manager standing behind a counter in Dhaka, Chittagong, or Savar. Every screen must be optimized for one-handed use on a 6-inch phone. Bangladesh Context. All currency is in BDT. Payment methods are bKash, Nagad, Rocket, and SSL Commerz. Tax compliance follows NBR Mushak standards. Offline-Resilient. POS and service entry must function during internet outages with automatic cloud sync when connectivity returns."),

        // ═══════════════════════════════════════
        // 4. SOLUTION DESIGN
        // ═══════════════════════════════════════
        h1("4. Solution Design: Seven-Phase Implementation"),

        // ── Phase 1 ──
        h2("4.1 Phase 1: Serialized Inventory Foundation"),
        body("This is the most critical phase. It establishes the core data model that every subsequent phase depends on. Without serialized tracking, nothing else in the CCTV module can function correctly. This phase is estimated at 3 to 4 development sessions."),
        h3("4.1.1 Segment 1A: Prisma Schema for Serialized Inventory"),
        body("The schema must introduce four new models that replace the bulk-inventory paradigm with serialized tracking. The SerialUnit model is the heart of the system: each row represents one physical device with a unique IMEI or serial number, linked to a Product (the SKU/catalog entry), a Batch (procurement batch for warranty start date), and a current status enum (IN_STOCK, SOLD, IN_REPAIR, RETURNED, WARRANTY_ACTIVE, WARRANTY_EXPIRED, DISPOSED)."),
        body("The Product model for the CCTV vertical does NOT have an aggregate inventory quantity field. Instead, the current stock count is derived by counting SerialUnits with status IN_STOCK for that product. This prevents the data inconsistency problems that plague dual-tracking systems. The SerialUnitHistory model is an append-only audit log recording every status change with timestamps, user IDs, and notes. The KitDefinition and KitComponent models allow creating virtual bundles (for example, a 4-camera CCTV set) that automatically check component availability and deduct individual SerialUnits upon sale."),

        h3("4.1.2 Segment 1B: IMEI-First Stock-In Workflow"),
        body("When a shop receives a shipment of phones or cameras, the stock-in process demands that every unit's IMEI or serial number is scanned or entered before the system allows the stock-in to complete. The workflow is: create or select a Purchase Order, then for each line item, scan or type IMEI/SN values. The system validates uniqueness (no duplicate IMEI across the entire platform), auto-links to the product catalog by matching the product on the PO line, and creates a SerialUnit row with status IN_STOCK. A barcode or QR code scanner can be connected via Bluetooth or USB and integrated through the browser's Web Serial API or a hidden input field with autofocus."),

        h3("4.1.3 Segment 1C: Batch Scanning and Rapid Entry"),
        body("For large shipments (a box of 50 cameras), the system provides a batch scanning mode. The user enters a count target, then rapidly scans barcodes one after another. The UI shows real-time progress (scanned 23 of 50), highlights duplicates in red, and allows bulk-assigning common attributes like purchase price, supplier, and warranty period. Scanned data is staged in local state and only committed to the database when the user confirms, preventing partial or corrupted data from power losses or accidental navigation."),

        h3("4.1.4 Segment 1D: Multi-Branch Inventory and Transfers"),
        body("Electronics retailers often operate from multiple locations. The system introduces a Branch model (linked to Business) and a Transfer model. When stock moves from the Dhaka warehouse to the Chittagong showroom, a Transfer is created with status IN_TRANSIT. The source branch's serial units are moved to a TRANSIT pseudo-status. Upon confirmation by the receiving branch, the status changes to IN_STOCK at the destination. A real-time branch inventory dashboard shows current stock levels, in-transit quantities, and low-stock alerts per branch."),

        h3("4.1.5 Segment 1E: Kit and Bundle Management"),
        body("CCTV retailers frequently sell pre-configured packages (for example, a 4-camera kit with NVR, 4 cameras, cables, and power supplies). The KitDefinition model stores the bundle composition. When a kit is sold, the system validates that all required component SerialUnits are available, then deducts them individually. If components are out of stock, the sale is blocked with a clear message indicating which component is missing. Kits can also have optional add-ons that the customer can choose during the sale."),

        // ── Phase 2 ──
        h2("4.2 Phase 2: Servicing and Repair Lifecycle (Job Cards)"),
        body("This phase builds the servicing management system that transforms InventoryOS from a pure inventory tool into an operations platform. Electronics repair is a core revenue stream for CCTV shops, and managing it digitally provides significant competitive advantage. Estimated at 3 to 4 development sessions."),
        h3("4.2.1 Segment 2A: Job Card Management"),
        body("The JobCard model is the central document for every repair. It captures: the customer's information, the device's SerialUnit reference, physical condition at intake (pre-existing scratches, dents, screen cracks, documented via photos), the reported fault description, estimated repair cost, assigned technician, current status (RECEIVED, DIAGNOSING, AWAITING_PARTS, IN_PROGRESS, TESTING, READY_FOR_DELIVERY, DELIVERED, OUTSOURCED), and completion timestamps. The job card is created from the stock-in screen or the customer's purchase history."),

        h3("4.2.2 Segment 2B: Spare Parts Integration"),
        body("Repair work consumes spare parts (LCD screens, ICs, batteries, connectors, cables). The JobCardPart model links a SerialUnit (the spare part being consumed) to a JobCard. When a technician logs a part usage, the system automatically deducts the spare part from inventory, adds its cost to the repair bill, and records the transaction in the SerialUnitHistory audit log. If a required spare part is out of stock, the job card status can be set to AWAITING_PARTS, triggering an automatic purchase suggestion."),

        h3("4.2.3 Segment 2C: Technician Performance and Commissions"),
        body("The Technician model (linked to BusinessUser) tracks each technician's repair performance. Metrics include: total jobs completed, average turnaround time (TAT), first-time fix rate, and customer satisfaction rating. Commission rules are configurable per business: fixed rate per repair type, percentage of labor charge, or percentage of profit margin. The system auto-calculates commission at job card closure and generates a monthly commission summary report."),

        h3("4.2.4 Segment 2D: OTP-Based Secure Delivery"),
        body("When a repaired device is ready for pickup, the system generates a one-time password (OTP) sent to the customer's registered phone number via SMS. The delivery agent (or counter staff) must enter the OTP before the system allows the job card to be marked DELIVERED. This prevents unauthorized collection of devices and provides a verifiable chain of custody. For high-value devices (phones above a configurable BDT threshold), the system also captures the collector's NID number and a signature on the delivery screen."),

        h3("4.2.5 Segment 2E: Outsourced Repair Tracking"),
        body("Some repairs require specialized equipment or expertise not available in-house (for example, motherboard-level chip repair typically sent to Motalib Plaza specialists). The JobCard can be marked OUTSOURCED with a reference to an OutsourcedVendor, expected return date, and quoted cost. The system sends automated reminders if the vendor does not return the device by the expected date. Upon return, the job card reverts to TESTING status."),

        // ── Phase 3 ──
        h2("4.3 Phase 3: Point of Sale and Financial Management"),
        body("This phase builds the transactional backbone of the CCTV shop module. The POS must handle the fast-paced retail environment of an electronics shop while supporting the diverse payment landscape of Bangladesh. Estimated at 2 to 3 development sessions."),
        h3("4.3.1 Segment 3A: Versatile Payment Integration"),
        body("The Sale and Payment models support multiple payment methods per transaction: cash, debit/credit card (via card terminal reference number), and Mobile Financial Services (bKash, Nagad, Rocket via transaction ID). The POS screen allows splitting a single sale across multiple payment methods (for example, 5,000 BDT via bKash and 2,000 BDT in cash). Each payment is recorded as a separate Payment row linked to the Sale, ensuring accurate reconciliation. The payment status of the sale (PAID, PARTIALLY_PAID, PENDING) is auto-calculated from the sum of payments versus the total due."),

        h3("4.3.2 Segment 3B: EMI Sales Management"),
        body("High-value items (phones, NVR systems) are frequently sold on Equated Monthly Installments. The EMIPlan model stores the installment schedule: total amount, number of months, monthly payment amount, interest rate, start date, and payment status per installment. The system generates automated reminders for overdue installments ( configurable grace period, for example, 3 days after due date). Interest calculations follow reducing balance method by default, with an option for flat rate. Overdue amounts trigger in-app notifications and can optionally send SMS reminders to the customer."),

        h3("4.3.3 Segment 3C: Customer Loyalty and CRM"),
        body("The Customer model (shared across verticals) gains loyalty-specific fields: loyaltyPoints (integer, earned per purchase), totalPurchaseAmount (for tier calculation), and preferredPaymentMethod. Points are earned at a configurable rate (for example, 1 point per 100 BDT spent) and can be redeemed at checkout (for example, 100 points equals 10 BDT discount). The customer profile screen shows purchase history, active warranties, pending EMI payments, and loyalty point balance. Personalized offers can be configured by the shop owner (for example, double points during Eid season)."),

        h3("4.3.4 Segment 3D: Warranty Tracking and Alerts"),
        body("Every SerialUnit sold carries a warranty period (stored on the SerialUnit as warrantyMonths). The system automatically calculates warranty start date from the sale date and warranty end date. A daily cron job scans for warranties expiring within 30 days and generates in-app notifications for the shop owner and optionally SMS alerts for the customer. The warranty status is visible on the SerialUnit detail screen and the customer's purchase history. During a repair job card, the system auto-checks warranty status and flags whether the repair is covered under warranty or chargeable."),

        // ── Phase 4 ──
        h2("4.4 Phase 4: CCTV Project and Field Management"),
        body("This phase addresses the unique requirements of CCTV installation projects, which are fundamentally different from over-the-counter retail sales. A CCTV project involves site surveys, equipment planning, installation scheduling, and ongoing maintenance contracts. Estimated at 2 to 3 development sessions."),
        h3("4.4.1 Segment 4A: Project and Site Survey Management"),
        body("The CCTVProject model represents an installation project linked to a Business (customer) and a Sale. The SiteSurvey model captures: uploaded floor plan images, tagged camera positions (pin-dropped on the floor plan image with a coordinate system), cable route annotations, and blind spot analysis notes. The survey screen allows the technician to upload a site photo or floor plan, tap to place camera markers, and draw approximate cable routes. This information is saved and accessible to the installation team."),

        h3("4.4.2 Segment 4B: Storage Estimation Calculator"),
        body("A built-in HDD storage calculator helps technicians and sales staff quickly determine the required storage capacity for a surveillance system. The user inputs: number of cameras, resolution (720p, 1080p, 2MP, 4MP, 8MP), frame rate (15fps, 25fps, 30fps), compression type (H.264, H.265), and desired retention days (7, 15, 30, 60, 90). The calculator outputs: required storage per camera per day, total daily storage, and recommended HDD capacity (with a 20% safety margin). The calculation formula is industry-standard: Storage(GB) = (Bitrate_Mbps x 3600 x Hours_per_Day x Days) / (8 x 1024). H.265 compression typically reduces storage by approximately 50% compared to H.264."),

        h3("4.4.3 Segment 4C: Annual Maintenance Contracts"),
        body("The AMC model manages recurring service agreements for corporate and institutional clients. An AMC record includes: client information, contract period (start date, end date), number of site visits included, covered equipment (linked to SerialUnits), monthly or annual fee, payment schedule, and service level agreement terms. The system generates automated alerts 30 days before contract renewal. Each maintenance visit is logged as an AMCVisit with date, technician, work performed, and parts replaced. The AMC dashboard shows active contracts, revenue per contract, upcoming renewals, and visit history."),

        h3("4.4.4 Segment 4D: Installation Task Scheduling"),
        body("The InstallationTask model links a CCTVProject to scheduled installation dates, assigned technicians, and a checklist of tasks (mount cameras, run cables, configure NVR, test all feeds, train client). Each task can be marked complete individually. The system provides a calendar view showing all upcoming installations, their locations, and assigned technicians. Overdue installations trigger alerts to the shop manager."),

        // ── Phase 5 ──
        h2("4.5 Phase 5: NBR Fiscal Compliance"),
        body("For registered businesses in Bangladesh, compliance with National Board of Revenue (NBR) tax regulations is mandatory. This phase implements the three core Mushak documents and the associated registers. Estimated at 2 development sessions."),
        h3("4.5.1 Segment 5A: Business Identification and BIN Setup"),
        body("The Business model gains NBR-specific fields: BIN (Business Identification Number), tax registration status, applicable tax rate (default 15% VAT), HS code mappings per product category, and Mushak invoice prefix/sequence. The super-admin can configure default HS codes for common electronics categories (Cameras: 8525.89, NVRs: 8521.90, Cables: 8544.42, etc.). These defaults are pre-populated but editable per business."),

        h3("4.5.2 Segment 5B: Mushak 6.3 Tax Invoice Generation"),
        body("Every sale to a registered business customer generates a Mushak 6.3 tax invoice. The invoice includes: sequential invoice number (auto-generated, format configurable per business), seller BIN, buyer BIN, date of issue, product descriptions with HS codes, quantities, unit prices, VAT amounts per line item, total VAT, and grand total in both figures and words (English). The invoice is generated as a print-ready document using thermal printer support. The system stores a MushakInvoice record for audit trail."),

        h3("4.5.3 Segment 5C: Purchase Register (Mushak 6.1) and Sales Register (Mushak 6.2)"),
        body("The Purchase Register (Mushak 6.1) is auto-populated from all Purchase records: date, supplier name and BIN, chalan number, product descriptions, quantities, values, and VAT paid. The Sales Register (Mushak 6.2) is auto-populated from all Sale records with BIN-identified customers: date, customer name and BIN, invoice number, product descriptions, quantities, values, and VAT collected. Both registers are filterable by date range and exportable as PDF and Excel. They are the primary documents submitted during NBR audits."),

        h3("4.5.4 Segment 5D: Monthly VAT Return (Mushak 9.1)"),
        body("On the 15th of each month (or the NBR-specified due date), the system can auto-generate the Mushak 9.1 VAT return. This document summarizes: total sales (taxable and exempt), total VAT collected (output VAT), total purchases (taxable and exempt), total VAT paid (input VAT), net VAT payable or refundable, and any adjustments. The return is generated from the 6.1 and 6.2 register data, ensuring mathematical consistency. A validation step checks that the sum of individual invoices matches the register totals before allowing generation."),

        // ── Phase 6 ──
        h2("4.6 Phase 6: AI and Automation Features"),
        body("This phase brings the AI capabilities of the InventoryOS platform to the CCTV and electronics vertical. As with the pharmacy module, all AI features are gated behind the Pro AI subscription tier and protected by the 9-tier AI cost-control defense system. Estimated at 2 to 3 development sessions."),
        h3("4.6.1 Segment 6A: Predictive Demand Forecasting"),
        body("Using historical sales data, seasonal patterns (Eid shopping surges, pre-monsoon CCTV demand spikes), and local event calendars, the AI forecast endpoint predicts optimal stock levels per product for the next 30, 60, and 90 days. The algorithm considers: sales velocity trends, seasonal multipliers (derived from the existing report scheduling season/occasion infrastructure), supplier lead times, and current stock levels. The output is a reorder recommendation list sorted by urgency. Unlike the pharmacy module, this forecast does NOT use LLM calls; it is a deterministic algorithm, so it logs AI usage but does not consume tokens."),

        h3("4.6.2 Segment 6B: Smart Diagnostics via AI"),
        body("Technicians can describe a device's symptoms in natural language (or upload a photo of a damaged PCB) and receive AI-powered diagnostic suggestions. This feature uses the z-ai-web-dev-sdk's vision model (for photo analysis) and LLM (for symptom analysis). The AI is trained on a repair knowledge base specific to common electronics faults in the Bangladesh market (for example, Samsung phone water damage patterns, Hikvision camera firmware issues). Results include: probable cause, recommended repair steps, estimated difficulty level, and spare parts likely needed. The 9-tier defense ensures this feature cannot be abused."),

        h3("4.6.3 Segment 6C: HDD Health Prediction"),
        body("Surveillance HDDs are the highest-failure-rate component in CCTV systems. The system collects SMART data (Self-Monitoring, Analysis and Reporting Technology) from connected NVRs/DVRs via API or manual input (temperature, reallocated sectors, pending sectors, power-on hours, write error rate). The AI model analyzes trend data to predict HDD failures before they occur, generating alerts 7 to 14 days in advance. This prevents critical data loss and allows proactive replacement during scheduled maintenance visits. The prediction model uses statistical analysis (not LLM), so it is token-free."),

        h3("4.6.4 Segment 6D: Virtual AI Assistant"),
        body("An AI chat endpoint (similar to the pharmacy module's ai/chat) allows shop managers to ask natural-language questions such as: 'How many Samsung A54 units do I have across all branches?', 'Which repairs have been pending for more than 7 days?', 'Show me this month's top-selling cameras', or 'What is the total EMI receivable this week?'. The assistant translates natural language into database queries, executes them, and presents results in a formatted, conversational response. This feature uses LLM and is fully gated by the 9-tier AI cost control."),

        // ── Phase 7 ──
        h2("4.7 Phase 7: Technical Architecture Enhancements"),
        body("This phase addresses cross-cutting technical requirements that span all previous phases. These are the infrastructure investments that ensure the CCTV module is reliable, performant, and user-friendly in the real-world conditions of Bangladeshi electronics shops. Estimated at 2 development sessions."),
        h3("4.7.1 Segment 7A: Offline-First Resilience"),
        body("Internet connectivity in Bangladesh can be intermittent, especially in smaller cities and during load-shedding. The POS and service entry screens must function offline using a local storage layer (IndexedDB via a service worker or a lightweight in-memory store with disk persistence). When offline, all transactions are queued locally. Upon reconnection, the system automatically syncs queued transactions to the server, resolving conflicts using last-write-wins with server timestamp authority. A prominent connectivity indicator in the UI shows the current sync status (online, offline, syncing, sync-error)."),

        h3("4.7.2 Segment 7B: Thermal Printing and Bangla Support"),
        body("Electronics shops use 58mm or 80mm thermal printers for receipts. The system generates print-optimized receipt layouts with: business name and address (configurable), sale date and invoice number, itemized list with prices, VAT breakdown (for registered customers), payment method and amount, and a thank-you message. All receipt templates support Bengali text rendering using Noto Sans Bengali or equivalent web font loaded via the application. The printing uses the browser's print API with a dedicated print stylesheet that formats correctly for narrow thermal paper."),

        h3("4.7.3 Segment 7C: Cloud Accessibility and Remote Monitoring"),
        body("Shop owners frequently manage multiple branches and need to monitor operations remotely. The responsive web application (already mobile-first) is enhanced with a desktop-optimized dashboard showing: real-time sales across branches, stock level summaries, pending repairs, EMI collection status, and AMC renewal alerts. The dashboard uses Recharts for data visualization with charts optimized for the CCTV module's KPIs. Access is secured through the existing authentication system with role-based visibility (owners see all branches; managers see their assigned branch)."),

        // ═══════════════════════════════════════
        // 5. IMPLEMENTATION ROADMAP
        // ═══════════════════════════════════════
        h1("5. Implementation Roadmap and Milestones"),
        body("The following table summarizes the phased implementation plan with effort estimates and dependencies. Each phase is designed to produce a testable, deployable increment."),

        makeTable(
          ["Phase", "Theme", "Sessions", "Depends On", "Deliverable"],
          [
            ["1A", "Serialized Inventory Schema", "1", "None", "Prisma models + migration"],
            ["1B", "IMEI-First Stock-In", "0.5", "1A", "Stock-in API + UI form"],
            ["1C", "Batch Scanning", "0.5", "1B", "Scanner component + bulk API"],
            ["1D", "Multi-Branch Transfers", "0.5", "1A", "Branch + Transfer models + API"],
            ["1E", "Kit Management", "0.5", "1A", "Kit models + bundle sale logic"],
            ["2A", "Job Card Core", "1", "1A", "JobCard model + CRUD API + UI"],
            ["2B", "Spare Parts Integration", "0.5", "2A", "Part consumption flow"],
            ["2C", "Technician Commissions", "0.5", "2A", "Commission engine + report"],
            ["2D", "OTP Delivery", "0.5", "2A", "OTP gen + verify + SMS"],
            ["2E", "Outsourced Repairs", "0.5", "2A", "Vendor model + tracking"],
            ["3A", "Payment Integration", "0.5", "1A", "Multi-method payment API"],
            ["3B", "EMI Management", "0.5", "3A", "EMI plan model + scheduler"],
            ["3C", "Loyalty CRM", "0.5", "3A", "Points engine + customer view"],
            ["3D", "Warranty Tracking", "0.5", "1A", "Warranty calc + alert cron"],
            ["4A", "Project Management", "0.5", "1A", "CCTVProject + SiteSurvey models"],
            ["4B", "Storage Calculator", "0.5", "None", "Calculator component"],
            ["4C", "AMC Management", "0.5", "1A", "AMC model + renewal alerts"],
            ["4D", "Installation Scheduling", "0.5", "4A", "Task model + calendar view"],
            ["5A", "BIN Setup", "0.25", "1A", "Business NBR fields"],
            ["5B", "Mushak 6.3 Invoice", "0.5", "3A", "Invoice template + PDF gen"],
            ["5C", "Purchase/Sales Registers", "0.5", "5B", "Register views + export"],
            ["5D", "Mushak 9.1 Return", "0.5", "5C", "Return calculation + PDF"],
            ["6A", "Demand Forecasting", "0.5", "1A", "Deterministic algorithm"],
            ["6B", "Smart Diagnostics", "0.5", "2A", "Vision + LLM endpoint"],
            ["6C", "HDD Health Prediction", "0.5", "4C", "SMART analysis engine"],
            ["6D", "AI Assistant", "0.5", "1A-5D", "NL-to-query chat endpoint"],
            ["7A", "Offline-First", "1", "Phase 3", "Service worker + sync queue"],
            ["7B", "Thermal Printing", "0.5", "5B", "Print stylesheet + Bangla font"],
            ["7C", "Cloud Dashboard", "0.5", "Phase 1-6", "Desktop dashboard + charts"],
          ]
        ),
        tableCaption("Table 2: Detailed Implementation Roadmap with Dependencies"),

        makeTable(
          ["Phase", "Total Sessions", "Cumulative", "Status"],
          [
            ["Phase 1: Serialized Inventory", "3-4", "3-4", "Pending"],
            ["Phase 2: Servicing & Repair", "3-4", "6-8", "Pending"],
            ["Phase 3: POS & Financial", "2-3", "8-11", "Pending"],
            ["Phase 4: CCTV Project Mgmt", "2-3", "10-14", "Pending"],
            ["Phase 5: NBR Compliance", "2", "12-16", "Pending"],
            ["Phase 6: AI & Automation", "2-3", "14-19", "Pending"],
            ["Phase 7: Architecture", "2", "16-21", "Pending"],
          ]
        ),
        tableCaption("Table 3: Phase Summary and Effort Estimation"),

        // ═══════════════════════════════════════
        // 6. RESOURCE REQUIREMENTS
        // ═══════════════════════════════════════
        h1("6. Resource Requirements"),
        h2("6.1 Development Resources"),
        body("The implementation requires one full-stack developer (or AI coding agent) working through the phases sequentially. The pharmacy module's architecture provides extensive code patterns and reusable components that will accelerate development. No additional infrastructure is required beyond the existing PostgreSQL database, Next.js application server, and Redis cache (optional). The Prisma schema will grow by approximately 15 to 20 new models, which is manageable within the existing 55-model schema."),

        h2("6.2 Domain Expertise Required"),
        body("To ensure the module accurately reflects real-world electronics retail workflows in Bangladesh, the following domain expertise is needed during the design and testing phases: a working CCTV shop owner or manager to validate job card workflows, AMC terms, and storage calculator assumptions; an electronics repair technician to validate spare parts consumption, diagnostic workflows, and commission structures; and an accountant or tax consultant familiar with NBR Mushak requirements to validate the fiscal compliance implementation."),

        // ═══════════════════════════════════════
        // 7. RISK ANALYSIS
        // ═══════════════════════════════════════
        h1("7. Risk Analysis and Mitigation"),
        makeTable(
          ["Risk", "Impact", "Probability", "Mitigation"],
          [
            ["Schema complexity grows unmanageable", "High", "Medium", "Add models incrementally per phase; run db push after each phase; never batch schema changes"],
            ["IMEI uniqueness enforcement fails at scale", "High", "Low", "Unique database constraint on SerialUnit.imei + businessId; application-level validation before write"],
            ["Offline sync creates data conflicts", "Medium", "Medium", "Use server timestamp as authority; last-write-wins with conflict log; manual resolution UI for edge cases"],
            ["NBR regulations change", "Medium", "Low", "Abstract Mushak templates into configurable services; update template without code changes"],
            ["AI cost exceeds budget for CCTV tenants", "Medium", "Medium", "Reuse existing 9-tier defense; set CCTV-specific thresholds (higher for diagnostics, lower for chat)"],
            ["Barcode scanner compatibility issues", "Low", "Medium", "Use standard Web API input field approach; test with 3+ scanner brands common in BD market"],
            ["Thermal printer formatting issues", "Low", "Medium", "Support ESC/POS commands via browser print API; provide 58mm and 80mm templates; test with Epson TM series"],
            ["Multi-branch sync latency", "Medium", "Low", "Real-time via existing WebSocket infrastructure; fallback to polling every 30 seconds"],
          ]
        ),
        tableCaption("Table 4: Risk Assessment Matrix"),

        // ═══════════════════════════════════════
        // 8. EXPECTED BENEFITS
        // ═══════════════════════════════════════
        h1("8. Expected Benefits and Evaluation"),
        h2("8.1 Business Benefits"),
        body("For the shop owner, the CCTV module eliminates manual tracking of IMEI numbers on paper registers, reducing stock discrepancies by an estimated 90%. The job card system brings visibility to the repair pipeline, reducing average repair turnaround time by targeting a 30% improvement. Automated warranty tracking prevents revenue loss from missed warranty claims and improves customer satisfaction through proactive communication. The EMI management feature ensures no installment payment is missed, directly improving cash flow collection."),
        body("The NBR compliance automation eliminates the manual effort of preparing Mushak documents, reducing month-end closing time from days to hours and eliminating the risk of tax calculation errors. The AI-powered demand forecasting reduces both overstocking (tying up capital) and stockouts (losing sales), targeting a 20% improvement in inventory turnover ratio."),

        h2("8.2 Platform Benefits"),
        body("For the InventoryOS platform, activating the CCTV vertical proves the multi-vertical architecture works in production. The patterns established here (serialized tracking, job cards, project management, fiscal compliance) create reusable templates for the remaining verticals: grocery, restaurant, mobile shop, electric shop, and bakery. Each subsequent vertical will require progressively less effort because the infrastructure investments made in the CCTV module will be shared."),

        h2("8.3 Evaluation Criteria"),
        makeTable(
          ["Criterion", "Measurement Method", "Target"],
          [
            ["Serialized tracking accuracy", "Audit: physical count vs. system count", "> 99.5% accuracy"],
            ["Repair TAT improvement", "Compare average TAT before vs. after", "> 30% reduction"],
            ["NBR compliance", "Accountant review of generated Mushak docs", "Zero calculation errors"],
            ["AI feature adoption", "AI usage logs per Pro AI tenant", "> 10 AI calls/month/tenant"],
            ["User satisfaction", "Post-launch survey (NPS)", "NPS > 40"],
            ["Platform revenue", "Subscription conversion rate", "> 5% free-to-paid conversion"],
          ]
        ),
        tableCaption("Table 5: Evaluation Criteria and Targets"),
      ],
    },
  ],
});

// ── Generate ──
const OUTPUT = "/home/z/inventoryos/download/InventoryOS_CCTV_Shop_Module_Implementation_Plan.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Generated:", OUTPUT);
});