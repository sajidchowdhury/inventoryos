const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, LevelFormat, TableOfContents,
} = require("docx");
const fs = require("fs");

// ── Palette: GO-1 Graphite Orange (proposal/plan) ──
const P = {
  bg: "1A2330", primary: "FFFFFF", accent: "D4875A",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
};
const c = (hex) => hex.replace("#", "");

// ── Body palette (dark text on white) ──
const bodyPrimary = "1A2330";
const bodyText = "000000";
const bodySecondary = "607080";
const bodyAccent = "D4875A";

// ── Borders helpers ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const tableBorder = {
  top: { style: BorderStyle.SINGLE, size: 2, color: c(bodyAccent) },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: c(bodyAccent) },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E0D8D0" },
  insideVertical: { style: BorderStyle.NONE },
};

// ── Cover helpers ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11; // English chars are ~half CJK
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 5) { titlePt -= 2; continue; }
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
  const breakAfter = new Set([' ', '-', '/', ':', '—', ',', ';']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = Math.min(charsPerLine, remaining.length); i >= Math.floor(charsPerLine * 0.5); i--) {
      if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 3) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, metaLineCount = 0, fixedHeight = 800 } = params;
  const SAFETY = 1500;
  const usableHeight = 16838 - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const contentHeight = titleHeight + subtitleHeight + metaHeight + fixedHeight + 900;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const topSpacing = Math.min(Math.floor(safeRemaining * 0.5), 4800);
  const bottomSpacing = Math.max(Math.floor(safeRemaining * 0.35), 800);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

function buildCoverR1(config) {
  const palette = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, metaLineCount: (config.metaLines || []).length,
  });

  const children = [];
  // Top spacer
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // English label with bottom border
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(palette.accent), space: 8 } },
      children: [new TextRun({ text: config.englishLabel, font: { ascii: "Calibri" }, size: 18, color: c(palette.accent), characterSpacing: 60 })],
    }));
  }

  // Title lines
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { line: Math.ceil(titlePt * 23), lineRule: "atLeast", after: 60 },
      children: [new TextRun({ text: titleLines[i], font: { ascii: "Calibri" }, size: titleSize, bold: true, color: c(palette.cover.titleColor) })],
    }));
  }

  // Subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: config.subtitle, font: { ascii: "Calibri" }, size: 22, color: c(palette.cover.subtitleColor) })],
    }));
  }

  // Meta lines with left accent border
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { before: 60, after: 60 },
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: c(palette.accent), space: 10 } },
      children: [new TextRun({ text: line, font: { ascii: "Calibri" }, size: 18, color: c(palette.cover.metaColor) })],
    }));
  }

  // Bottom spacer
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // Footer separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(palette.accent), space: 12 } },
    children: [],
  }));

  // Footer
  const footerParts = [];
  if (config.footerLeft) footerParts.push(new TextRun({ text: config.footerLeft, font: { ascii: "Calibri" }, size: 16, color: c(palette.cover.footerColor) }));
  if (config.footerLeft && config.footerRight) footerParts.push(new TextRun({ text: "    ", font: { ascii: "Calibri" }, size: 16 }));
  if (config.footerRight) footerParts.push(new TextRun({ text: config.footerRight, font: { ascii: "Calibri" }, size: 16, color: c(palette.cover.footerColor) }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { before: 80 },
    children: footerParts,
  }));

  return [
    new Table({
      borders: allNoBorders,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        height: { value: 16838, rule: "exact" },
        verticalAlign: "top",
        children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: c(palette.bg) },
          borders: allNoBorders,
          children,
        })],
      })],
    }),
  ];
}

// ── Body component helpers ──
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, font: { ascii: "Calibri" }, color: c(bodyPrimary) })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, font: { ascii: "Calibri" }, color: c(bodyPrimary) })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, font: { ascii: "Calibri" }, color: c(bodyPrimary) })],
  });
}

function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Calibri" }, color: c(bodyText) })],
  });
}

function bodyParaBold(boldPart, normalPart) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    children: [
      new TextRun({ text: boldPart, bold: true, size: 24, font: { ascii: "Calibri" }, color: c(bodyText) }),
      new TextRun({ text: normalPart, size: 24, font: { ascii: "Calibri" }, color: c(bodyText) }),
    ],
  });
}

function bulletItem(text, ref = "bullet-main") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Calibri" }, color: c(bodyText) })],
  });
}

function bulletItemBold(boldPart, normalPart, ref = "bullet-main") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 312 },
    children: [
      new TextRun({ text: boldPart, bold: true, size: 24, font: { ascii: "Calibri" }, color: c(bodyText) }),
      new TextRun({ text: normalPart, size: 24, font: { ascii: "Calibri" }, color: c(bodyText) }),
    ],
  });
}

// Table helper
function makeTable(headers, rows) {
  const colCount = headers.length;
  const colWidth = Math.floor(100 / colCount);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorder,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map(h => new TableCell({
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: c(P.table.headerBg) },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, font: { ascii: "Calibri" }, color: c(P.table.headerText) })] })],
        })),
      }),
      ...rows.map((row, idx) => new TableRow({
        cantSplit: true,
        children: row.map(cell => new TableCell({
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? c(P.table.surface) : "FFFFFF" },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, font: { ascii: "Calibri" }, color: c(bodyText) })] })],
        })),
      })),
    ],
  });
}

// ── Issue description helper ──
function issueBlock(issueId, title, description, currentBehavior, expectedBehavior) {
  const items = [];
  items.push(bodyParaBold(`Issue #${issueId}: ${title}`, ""));
  items.push(bodyPara(description));
  items.push(bulletItemBold("Current Behavior: ", currentBehavior, "bullet-main"));
  items.push(bulletItemBold("Expected Behavior: ", expectedBehavior, "bullet-main"));
  return items;
}

// ── Phase solution helper ──
function phaseSolution(phaseId, phaseTitle, issueIds, description, subSteps) {
  const items = [];
  items.push(heading2(`Phase ${phaseId}: ${phaseTitle}`));
  items.push(bodyPara(`Issues Addressed: ${issueIds}`));
  items.push(bodyPara(description));
  if (subSteps && subSteps.length > 0) {
    items.push(heading3("Implementation Steps"));
    subSteps.forEach((step, i) => {
      items.push(bulletItemBold(`Step ${i + 1}: `, step, "bullet-sub"));
    });
  }
  return items;
}

// ── Numbering configs ──
const numberingConfig = [
  {
    reference: "bullet-main",
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  },
  {
    reference: "bullet-sub",
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }],
  },
  {
    reference: "num-phase",
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  },
  {
    reference: "num-exec",
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  },
];

// ── Build Document ──
async function main() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: { ascii: "Calibri" }, size: 24, color: c(bodyText) },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: {
          run: { font: { ascii: "Calibri" }, size: 32, bold: true, color: c(bodyPrimary) },
          paragraph: { spacing: { before: 400, after: 160, line: 312 } },
        },
        heading2: {
          run: { font: { ascii: "Calibri" }, size: 28, bold: true, color: c(bodyPrimary) },
          paragraph: { spacing: { before: 300, after: 120, line: 312 } },
        },
        heading3: {
          run: { font: { ascii: "Calibri" }, size: 24, bold: true, color: c(bodyPrimary) },
          paragraph: { spacing: { before: 200, after: 100, line: 312 } },
        },
      },
    },
    numbering: { config: numberingConfig },
    sections: [
      // ── SECTION 1: Cover ──
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
        },
        children: buildCoverR1({
          title: "InventoryOS CCTV Module",
          subtitle: "Bug Fixes & Feature Implementation Plan",
          englishLabel: "PHASED SOLUTION ROADMAP",
          metaLines: ["14 Identified Issues | 7 Implementation Phases", "Version 1.0 | July 2025"],
          footerLeft: "InventoryOS",
          footerRight: "Confidential",
          palette: P,
        }),
      },

      // ── SECTION 2: TOC ──
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          },
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(bodySecondary) })],
            })],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 300 },
            children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { ascii: "Calibri" }, color: c(bodyPrimary) })],
          }),
          new TableOfContents("TOC", {
            hyperlink: true,
            headingStyleRange: "1-3",
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({ text: "(Right-click the Table of Contents above and select 'Update Field' to refresh page numbers)", italics: true, size: 18, color: c(bodySecondary), font: { ascii: "Calibri" } }),
              new PageBreak(),
            ],
          }),
        ],
      },

      // ── SECTION 3: Body ──
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: "InventoryOS CCTV Module \u2014 Phased Solution Plan", size: 16, color: c(bodySecondary), font: { ascii: "Calibri" } })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(bodySecondary) })],
            })],
          }),
        },
        children: [
          // ═══════════════════════════════════════
          // 1. EXECUTIVE SUMMARY
          // ═══════════════════════════════════════
          heading1("1. Executive Summary"),
          bodyPara("This document provides a comprehensive phased solution plan for addressing 14 identified issues in the InventoryOS CCTV Shop module. The issues range from navigation bugs and broken UI components to missing features and incomplete system workflows. Each issue has been analyzed, categorized by severity and complexity, and organized into 7 implementation phases designed for systematic resolution."),
          bodyPara("The phasing strategy prioritizes quick wins and critical fixes first (Phase 1), followed by workflow improvements (Phases 2-3), new feature development (Phases 4-6), and finally the most complex system additions (Phase 7). This approach ensures visible progress after each phase while managing risk through incremental delivery."),

          // ═══════════════════════════════════════
          // 2. CURRENT STATE & PROBLEM ANALYSIS
          // ═══════════════════════════════════════
          heading1("2. Current State & Problem Analysis"),
          bodyPara("The following 14 issues were identified during user testing of the CCTV Shop module. Each issue is documented with its current behavior and expected behavior."),

          heading2("2.1 Navigation & Routing Issues"),
          ...issueBlock(
            1, "Sales Report Click Opens Wrong Page",
            "On the CCTV Home page, clicking the Sales Report quick-action card opens the All Reports dashboard instead of navigating to the Sales History view. This is a routing configuration error where the navigate() call targets the wrong view identifier.",
            "Clicking Sales Report card opens the All Reports dashboard (reports view).",
            "Clicking Sales Report card should open the Sales History page to view historical sales transactions."
          ),
          ...issueBlock(
            2, "Quick Reports Section Has Wrong Item",
            "The Quick Reports section on the Home page currently displays 'Project Report' as one of the four quick-access report cards. Based on user requirements, this slot should display 'Due Book' instead, as Due Book is one of the most frequently needed reports for CCTV shop operations.",
            "Quick Reports shows: Sales Report, Due Book (should be here), Project Report (wrong), Purchase Report.",
            "Quick Reports should show: Sales Report, Due Book, Purchase Report, and the fourth item as currently configured. Remove 'Project Report' and replace with 'Due Book'."
          ),

          heading2("2.2 UI & Style Issues"),
          ...issueBlock(
            3, "AMC Log Visit Page Has Broken Styles",
            "After creating an AMC (Annual Maintenance Contract) entry and navigating to the 'Log Visit' page, the page layout and styles are visually broken. Elements appear misaligned, input fields may overlap, and the overall visual design does not match the established CCTV module design system.",
            "Log Visit page after AMC creation shows broken CSS/layout with misaligned elements.",
            "Log Visit page should render with consistent styling matching the AMC list and other CCTV module pages."
          ),
          ...issueBlock(
            4, "Back Button Broken on Project Sub-Pages",
            "In the Projects section, when a user navigates through the creation flow (Create Project > Site Survey > Equipment Tracking), the back button located at the top-left corner of the Equipment Tracking page does not function correctly. The user cannot navigate back to the previous step.",
            "Back button on Equipment Tracking page (and potentially Site Survey page) does not work.",
            "Back button should navigate the user to the previous step in the project creation flow (Site Survey or Project List)."
          ),

          heading2("2.3 Broken Features & API Errors"),
          ...issueBlock(
            12, "Mushak Report Not Active",
            "The Mushak Report (VAT tax report required for Bangladesh tax compliance) is listed in the All Reports dashboard but is not functional. Clicking on it either shows a placeholder, does nothing, or navigates to an incomplete page.",
            "Mushak Report menu item exists in All Reports dashboard but is non-functional.",
            "Mushak Report should open a functional report page showing VAT-compliant Mushak format data for selected date ranges and products."
          ),
          ...issueBlock(
            13, "Cloud Dashboard Broken (API Error)",
            "The Cloud Dashboard page crashes with a SyntaxError when loading. The error occurs in CCTVCloudDashboard.tsx at line 121 during JSON parsing of the API response. The fetch to /api/businesses/{businessId}/cctv/cloud-dashboard returns an empty or malformed response body, causing res.json() to throw 'Unexpected end of JSON input'.",
            "Console error: SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input at CCTVCloudDashboard.tsx:121",
            "Cloud Dashboard should either load successfully with data, or display a meaningful error/loading state instead of crashing."
          ),

          heading2("2.4 Workflow & UX Issues"),
          ...issueBlock(
            5, "Unclear Survey Workflow After Creation",
            "After creating a Site Survey for a project, there is no clear next step for the user. The workflow is ambiguous: the user does not know whether to proceed to Equipment Tracking, submit the survey, add more details, or navigate elsewhere. There is no visual guidance, status indicator, or suggested action after survey creation.",
            "After creating a site survey, the page does not indicate what the user should do next. No call-to-action or workflow guidance is present.",
            "After survey creation, the system should guide the user with clear next steps (e.g., 'Proceed to Equipment Tracking', 'Add Notes', 'Mark Survey Complete') with visible navigation options."
          ),
          ...issueBlock(
            6, "New Task Has No Save Button and No Projects in List",
            "When creating a new task, two critical issues exist: (a) There is no visible save/submit button on the task creation form, making it impossible to actually create a task. (b) The project dropdown/selector in the task form shows no projects even when projects have been created, suggesting a data-fetching or filtering issue.",
            "Task creation form has no save button and the project list is empty despite existing projects.",
            "Task creation form should have a clear save/submit button, and the project selector should populate with all active projects from the database."
          ),

          heading2("2.5 EMI System Issues"),
          ...issueBlock(
            7, "EMI Plan Products Not From Saved Product List",
            "The EMI (Equated Monthly Installment) plan creation page currently allows free-text entry for products instead of selecting from the existing saved product inventory. This leads to data inconsistency where EMI products do not match the actual inventory items.",
            "EMI plan creation uses free-text product entry instead of a product selector.",
            "EMI plan creation should provide a searchable dropdown/list that pulls products from the saved product inventory (the same products available in Stock In)."
          ),
          ...issueBlock(
            8, "Interest Rate Calculation Should Be Removed",
            "The EMI plan creation form includes an Interest Rate (%) field that allows users to set a custom interest rate. Per business requirements, the EMI system should not include interest rate calculations. The field should be removed entirely or defaulted to 0% and made read-only/unchangeable.",
            "EMI form includes an editable Interest Rate (%) field that affects EMI calculations.",
            "Interest Rate should be permanently set to 0% and the field should be either hidden or displayed as read-only (disabled). All EMI calculations should exclude interest."
          ),

          heading2("2.6 Missing Features"),
          ...issueBlock(
            9, "Setup Category Page Shows 'Coming Soon'",
            "The Category Management setup page currently displays a 'Coming Soon' placeholder instead of an actual functional category management interface. Users need the ability to create, edit, delete, and organize product categories for their inventory.",
            "Category management page shows 'Coming Soon' placeholder with no functionality.",
            "Full CRUD category management: create categories with name, description, and parent category; edit and delete categories; view all categories in a organized list/tree; assign categories to products."
          ),
          ...issueBlock(
            11, "Kits & Bundles Has No Post-Creation Functionality",
            "Users can create Kit & Bundle entries, but after creation there is no meaningful functionality. There is no way to: (a) use a kit/bundle in a sale, (b) track kit component inventory, (c) auto-deduct component quantities when a kit is sold, or (d) view kit composition and pricing breakdown.",
            "Kits & Bundles can be created but serve no functional purpose in the system.",
            "After creating a Kit/Bundle, users should be able to: sell kits as a single unit (with auto-deduction of component stock), view kit composition, set kit pricing (sum or custom), and see kit inventory availability based on component stock levels."
          ),

          heading2("2.7 System Enhancement Requests"),
          ...issueBlock(
            10, "Purchase Order Needs Serial Number Tracking",
            "The Stock In system has an excellent serial number tracking workflow where users select a product, specify the quantity, and enter serial numbers one by one (ideal for barcode scanner input). However, the Purchase Order system does not have this capability. When creating a purchase order from a supplier, users need to record serial numbers for each product received, with varying quantities per serial number batch.",
            "Purchase Order allows adding products with quantities but has no serial number entry per product line item.",
            "Purchase Order should support serial number entry per product line item, similar to Stock In. For example: buying 6 units of a product where 3 have serial numbers (SN-001, SN-002, SN-003), 2 have serial numbers (SN-010, SN-011), and 1 has no serial number. The user enters each batch individually."
          ),
          ...issueBlock(
            14, "CSV Product Import System Needed",
            "There is no way to bulk import products into the inventory. Users need to manually create each product one at a time, which is impractical for businesses with large existing product catalogs. A CSV import feature with a downloadable demo/template CSV file is required.",
            "No CSV import functionality exists. All products must be created manually.",
            "Provide: (a) A downloadable demo CSV template file with correct column headers and sample data, (b) A CSV upload interface in the Stock/Inventory section, (c) Validation and error handling for imported data, (d) Preview of imported data before confirmation."
          ),

          // ═══════════════════════════════════════
          // 3. PHASED SOLUTION DESIGN
          // ═══════════════════════════════════════
          heading1("3. Phased Solution Design"),
          bodyPara("The 14 issues have been organized into 7 implementation phases. Phases are ordered by: (a) severity of user impact, (b) implementation complexity (quick wins first), and (c) logical dependency between features. Each phase is designed to be independently testable and deployable."),

          // ── Phase 1 ──
          ...phaseSolution(
            1, "Critical Quick Fixes",
            "Issues #1, #2, #3, #4, #12, #13",
            "This phase addresses all critical bugs, navigation errors, and broken pages that prevent core functionality from working. These are independent fixes with low risk and high user impact. Each fix is isolated to a specific file or component.",
            [
              "Fix Sales Report navigation in CCTVDashboard.tsx: Change the navigate() target from 'reports' to 'sales-history' (or the correct sales history view identifier). Verify the target view exists in CCTVShell.tsx.",
              "Replace 'Project Report' with 'Due Book' in CCTVDashboard.tsx Quick Reports section. Update the icon, label, and navigate() target to point to the Due Book view. Ensure the Due Book view exists in the shell.",
              "Inspect and fix AMC Log Visit page styles in the AMC visit component. Compare CSS classes with working pages (e.g., AMC list page). Ensure consistent use of the CCTV module design system (gradient cards, proper spacing, form field styles).",
              "Fix the back button on Equipment Tracking and Site Survey pages. Verify the navigate() function correctly calls the parent route. Use the CCTV navigation store (useCCTVNavStore) for consistent back-navigation behavior.",
              "Build or activate the Mushak Report page. Create a new component CCTVReportsMushak that displays VAT-compliant Mushak format data. Wire it into CCTVShell.tsx. Include date range picker, product filter, and printable Mushak format output.",
              "Fix Cloud Dashboard API error. Add proper error handling in CCTVCloudDashboard.tsx before calling res.json(): check res.ok status and res.body. If the API endpoint does not exist yet, create it at /api/businesses/[id]/cctv/cloud-dashboard with mock/empty data. Add a loading skeleton and error fallback UI."
            ]
          ),

          // ── Phase 2 ──
          ...phaseSolution(
            2, "Task & Project Workflow Completion",
            "Issues #5, #6",
            "This phase completes the project and task management workflow. The project creation flow (Project > Site Survey > Equipment Tracking) needs clear user guidance, and the task creation system needs its core save functionality and project linking.",
            [
              "Design the post-survey workflow: After survey creation, display a success state with clear next-step buttons ('Proceed to Equipment Tracking', 'Add More Details', 'Back to Project'). Add a status indicator (e.g., step progress bar: Project > Survey > Equipment > Complete) on each sub-page.",
              "Add a Save/Submit button to the task creation form. Wire the button to the task creation API endpoint. Add form validation before submission.",
              "Debug the project list in the task creation form: Check the API call that fetches projects, ensure it returns the correct business-scoped projects, and verify the dropdown/selector component correctly maps API response to options.",
              "Add an empty state message when no projects exist ('No projects found. Create a project first.') with a direct link to project creation."
            ]
          ),

          // ── Phase 3 ──
          ...phaseSolution(
            3, "EMI System Overhaul",
            "Issues #7, #8",
            "This phase reworks the EMI (Equated Monthly Installment) plan creation system to use the actual product inventory and removes the interest rate calculation entirely.",
            [
              "Replace the free-text product input in the EMI plan form with a searchable product selector that fetches from /api/businesses/{businessId}/products (the same endpoint used by Stock In). Show product name, SKU, and current stock quantity in the selector.",
              "Remove the Interest Rate (%) input field from the EMI plan form. Set the internal interest rate value to 0 (zero) in all EMI calculation logic.",
              "Update the EMI calculation formula: Total Payable = Principal Amount (no interest). Monthly Installment = Total Payable / Number of Months. Ensure all display fields and summary tables reflect interest-free calculations.",
              "Update the EMI plan API to accept product IDs (from inventory) instead of free-text product names. Add API validation to ensure selected products exist in the business inventory."
            ]
          ),

          // ── Phase 4 ──
          ...phaseSolution(
            4, "Category Management System",
            "Issue #9",
            "This phase builds a complete Category Management system from scratch, replacing the 'Coming Soon' placeholder. This is a medium-complexity CRUD feature that touches the database schema, API layer, and UI.",
            [
              "Phase 4a - Database & API: Add Category model to Prisma schema (id, businessId, name, description, parentId for hierarchy, createdAt, updatedAt). Create API routes: GET /api/businesses/{id}/categories (list), POST (create), PUT /categories/[cid] (update), DELETE /categories/[cid] (delete). Run db:push and db:generate.",
              "Phase 4b - UI List Page: Build CCTVCategoryList.tsx with a searchable, filterable list of categories. Display category name, description, product count, and parent category. Include Create, Edit, and Delete actions. Use the established CCTV module card/table design system.",
              "Phase 4c - UI Create/Edit Form: Build CCTVCategoryForm.tsx with fields for name, description, and optional parent category (dropdown). Implement form validation (unique name within business). Wire to the category API endpoints.",
              "Phase 4d - Integration: Add category field to the product creation/edit forms. Update the Stock page 'Category' menu item to navigate to the new Category Management page. Add category filter to the product search in Stock page."
            ]
          ),

          // ── Phase 5 ──
          ...phaseSolution(
            5, "Purchase Order Serial Number System",
            "Issue #10",
            "This phase extends the Purchase Order system to support serial number tracking per product line item, mirroring the existing Stock In serial number workflow. This is a complex feature that requires UI, API, and database changes.",
            [
              "Phase 5a - Database: Add PurchaseOrderSerialNumber model (id, purchaseOrderItemId, serialNumber, createdAt) to Prisma schema. This links serial numbers to individual line items in a purchase order. Run db:push and db:generate.",
              "Phase 5b - UI Component: Create a reusable SerialNumberEntry component that can be used in both Stock In and Purchase Order flows. The component should: accept a target quantity, allow scanning/typing serial numbers one by one, show progress (e.g., '3 of 6 entered'), and allow partial serial number entry (not all items need serial numbers).",
              "Phase 5c - Purchase Order Form Integration: Add serial number entry to each product line item in the purchase order form. After adding a product and quantity, show an 'Add Serial Numbers' button/section that opens the SerialNumberEntry component for that line item.",
              "Phase 5d - API & Business Logic: Update purchase order API to accept serial numbers per line item. On purchase order confirmation, create stock-in records with the provided serial numbers. Validate no duplicate serial numbers across the business inventory.",
              "Phase 5e - Serial Number Tracking: Ensure purchase order serial numbers appear in the serial items list (same as stock-in serial numbers). Add a source indicator ('Stock In' vs 'Purchase Order') to serial item records for traceability."
            ]
          ),

          // ── Phase 6 ──
          ...phaseSolution(
            6, "Kits & Bundles Functionality",
            "Issue #11",
            "This phase transforms the Kits & Bundles feature from a data-entry-only form into a functional inventory system where kits can be sold as single units with automatic component stock deduction.",
            [
              "Phase 6a - Database: Review and enhance the Kit/Bundle schema. Ensure each kit has: a list of component products with required quantities, a pricing model (auto-sum from components or custom price), and stock availability (calculated from minimum component stock / required quantity).",
              "Phase 6b - Kit Composition UI: Build a kit detail/builder page where users can: add/remove component products from inventory, set required quantity per component, see real-time cost calculation (sum of component costs), and set a selling price (default: auto-sum).",
              "Phase 6c - Kit Inventory Calculation: Implement logic to calculate available kit stock based on component availability. For example, if a kit needs 2x Camera A (stock: 10) and 1x DVR (stock: 5), the kit is available 5 times (limited by DVR). Display this calculated availability on the kit list.",
              "Phase 6d - Kit in Sales: Enable adding kits to sales/invoices as a single line item. When a kit sale is confirmed, automatically deduct component quantities from inventory. Show kit breakdown (components and quantities) on the invoice.",
              "Phase 6e - Kit Serial Number Support: If kit components are serial-tracked products, allow recording which specific serial numbers are included when a kit is assembled/sold."
            ]
          ),

          // ── Phase 7 ──
          ...phaseSolution(
            7, "CSV Product Import System",
            "Issue #14",
            "This phase builds a complete CSV import system for bulk product creation. It is the most complex phase as it requires file parsing, data validation, error handling, and a preview-confirm workflow.",
            [
              "Phase 7a - Demo CSV Template: Create a downloadable CSV template file with columns: name, sku, category, brand, unit, costPrice, sellingPrice, stock, lowStockAlert, description. Include 5-10 sample rows with realistic CCTV product data. Host this file as a static asset accessible via /templates/product-import-template.csv.",
              "Phase 7b - Upload UI: Build a CSV Import page (CCTVImportProducts.tsx) accessible from the Stock page. Include: a file upload area (drag-and-drop + click), a 'Download Template' button linking to the demo CSV, and basic file validation (file type, size limit).",
              "Phase 7c - CSV Parsing & Validation: Implement server-side CSV parsing (use a library like papaparse or Node.js built-in). Validate each row: required fields present, correct data types (prices are numbers, stock is integer), valid category references, no duplicate SKUs. Return validation results with row-level errors.",
              "Phase 7d - Preview & Confirm: After upload and validation, display a preview table showing: all valid rows (with column mapping), any rows with warnings (highlighted in yellow), any rows with errors (highlighted in red with error descriptions), and summary stats (X valid, Y warnings, Z errors). User can remove invalid rows or cancel.",
              "Phase 7e - Import Execution: On confirmation, batch-insert valid products into the database using Prisma transactions. Show a progress indicator during import. Display final result summary: X products imported successfully, Y skipped due to errors. Auto-refresh the product list after import."
            ]
          ),

          // ═══════════════════════════════════════
          // 4. IMPLEMENTATION ROADMAP & MILESTONES
          // ═══════════════════════════════════════
          heading1("4. Implementation Roadmap & Milestones"),
          bodyPara("The following table summarizes the 7 phases with their estimated complexity, affected issues, and key deliverables."),

          makeTable(
            ["Phase", "Title", "Issues", "Complexity", "Key Deliverable"],
            [
              ["1", "Critical Quick Fixes", "#1, #2, #3, #4, #12, #13", "Low", "All navigation and broken pages fixed"],
              ["2", "Task & Project Workflow", "#5, #6", "Medium", "Complete project creation flow"],
              ["3", "EMI System Overhaul", "#7, #8", "Medium", "Interest-free EMI with product selector"],
              ["4", "Category Management", "#9", "Medium", "Full CRUD category system"],
              ["5", "PO Serial Numbers", "#10", "High", "Serial tracking in purchase orders"],
              ["6", "Kits & Bundles", "#11", "High", "Functional kit sales with stock deduction"],
              ["7", "CSV Import", "#14", "High", "Bulk product import with validation"],
            ]
          ),

          bodyPara(""),

          // ═══════════════════════════════════════
          // 5. RISK ANALYSIS & MITIGATION
          // ═══════════════════════════════════════
          heading1("5. Risk Analysis & Mitigation"),
          bodyPara("Each phase carries specific risks that should be mitigated through careful implementation and testing."),

          makeTable(
            ["Risk", "Affected Phase", "Impact", "Mitigation Strategy"],
            [
              ["Navigation fix breaks other routes", "Phase 1", "Medium", "Verify all navigation targets exist in CCTVShell before changing. Test all home page cards after fix."],
              ["Mushak Report tax format incorrect", "Phase 1", "Medium", "Reference official Bangladesh Mushak format. Consult user for specific field requirements."],
              ["Cloud Dashboard API returns empty data permanently", "Phase 1", "Low", "Add graceful empty state UI with 'No data available' message instead of crash."],
              ["Project list API returns wrong business scope", "Phase 2", "Medium", "Add businessId filter to all project/task API queries. Test with multiple businesses."],
              ["Category deletion affects existing products", "Phase 4", "High", "Prevent deletion of categories that have products assigned. Show product count and require reassignment before delete."],
              ["Serial number duplicates across PO and Stock In", "Phase 5", "High", "Implement unique constraint on serial numbers per business. Validate at API level before saving."],
              ["Kit stock calculation race condition", "Phase 6", "Medium", "Use database transactions for kit sale stock deduction. Recalculate availability in real-time."],
              ["CSV import of large files causes timeout", "Phase 7", "Medium", "Implement chunked processing (batch inserts of 100-500 rows). Show progress indicator."],
              ["CSV parsing fails on malformed files", "Phase 7", "Low", "Robust error handling with row-level error reporting. Skip bad rows, import valid ones."],
            ]
          ),

          bodyPara(""),

          // ═══════════════════════════════════════
          // 6. DEPENDENCY GRAPH
          // ═══════════════════════════════════════
          heading1("6. Dependency Graph"),
          bodyPara("While most phases are independent, some have logical dependencies that affect the recommended execution order."),

          makeTable(
            ["Phase", "Depends On", "Reason"],
            [
              ["Phase 1", "None", "Independent bug fixes and navigation corrections"],
              ["Phase 2", "None", "Independent workflow improvements"],
              ["Phase 3", "None", "Independent EMI system changes"],
              ["Phase 4", "None", "Independent new feature (Category CRUD)"],
              ["Phase 5", "Phase 1 (partial)", "Serial number entry component should be tested with Stock In flow first"],
              ["Phase 6", "Phase 4 (recommended)", "Kit components reference categories for organization"],
              ["Phase 7", "Phase 4 (recommended)", "CSV import maps to categories; category system should exist first"],
            ]
          ),

          bodyPara("Phases 1-4 can be executed in parallel or in any order. Phase 5 should start after Phase 1 serial number fixes are verified. Phases 6 and 7 benefit from Phase 4 (Category Management) being complete but are not strictly blocked."),

          // ═══════════════════════════════════════
          // 7. EXPECTED BENEFITS & EVALUATION
          // ═══════════════════════════════════════
          heading1("7. Expected Benefits & Evaluation"),
          bodyPara("Upon completion of all 7 phases, the CCTV Shop module will achieve the following improvements:"),

          bodyParaBold("Navigation Reliability: ", "All quick-action cards, back buttons, and report links will navigate to the correct destination. Zero broken navigation paths across the entire CCTV module."),
          bodyParaBold("Data Integrity: ", "EMI plans will reference actual inventory products. Serial numbers will be tracked consistently across Stock In and Purchase Order flows. Kits & Bundles will maintain accurate component-level stock counts."),
          bodyParaBold("Operational Efficiency: ", "CSV import will reduce product setup time from hours to minutes. Category management will enable organized inventory. Purchase order serial tracking will eliminate manual post-purchase stock reconciliation."),
          bodyParaBold("Regulatory Compliance: ", "The Mushak Report will enable proper VAT documentation for tax filings, a critical requirement for Bangladesh-based businesses."),
          bodyParaBold("User Experience: ", "Clear workflow guidance in project/task creation, functional kits & bundles, and consistent styling across all pages will significantly reduce user confusion and support requests."),

          bodyPara(""),
          bodyPara("Each phase should be verified independently using the Post-Deployment Checklist approach: test the specific feature in a browser, verify no console errors, confirm correct data persistence, and validate the user workflow end-to-end before proceeding to the next phase."),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("/home/z/my-project/InventoryOS_CCTV_Phased_Solution_Plan.docx", buffer);
  console.log("Document generated: /home/z/my-project/InventoryOS_CCTV_Phased_Solution_Plan.docx");
}

main().catch(console.error);