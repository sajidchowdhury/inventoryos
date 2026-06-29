// Main orchestrator — assembles Cover + TOC + Body into final docx
const H = require("./ai-report-helpers");
const {
  P, c, allNoBorders, tableBorders,
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType,
} = H;
const fs = require("fs");

const { buildCover } = require("./ai-report-cover");
const { buildExecSummary, buildFeatureInventory, buildHealthDashboard } = require("./ai-report-body1");
const { buildCostModel, buildRiskAnalysis } = require("./ai-report-body2");
const { buildMitigationPlan, buildFinalVerdict } = require("./ai-report-body3");

// =============================================================================
// PAGE LAYOUT CONSTANTS
// =============================================================================
const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

// =============================================================================
// HEADER / FOOTER BUILDERS
// =============================================================================
function buildHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { line: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 4 } },
      children: [new TextRun({
        text: "InventoryOS AI Features Report",
        size: 18, color: c(P.secondary), italics: true,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    })],
  });
}

function buildFooter(format = "arabic") {
  // format = "arabic" or "roman" — controls the PAGE field instruction
  // We will post-process to ensure proper rendering in both Word and WPS
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 },
      children: [
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 18, color: c(P.secondary),
          font: { ascii: "Calibri" },
        }),
      ],
    })],
  });
}

// =============================================================================
// TOC SECTION CONTENT
// =============================================================================
function buildTocSection() {
  return [
    // TOC title — NO HeadingLevel (otherwise TOC indexes itself)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360, line: 360 },
      children: [new TextRun({
        text: "Table of Contents",
        bold: true, size: 36, color: c(P.primary),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    }),
    // TOC field — index Heading 1-3
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    // Mandatory refresh hint
    new Paragraph({
      spacing: { before: 240, after: 0, line: 312 },
      children: [new TextRun({
        text: "Note: This Table of Contents is generated via field codes. To refresh page numbers after editing, right-click the TOC and select \"Update Field.\"",
        italics: true, size: 18, color: c(P.secondary),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    }),
    // PageBreak to separate TOC from body
    new Paragraph({ children: [new (require("docx").PageBreak)()] }),
  ];
}

// =============================================================================
// BUILD BODY CONTENT
// =============================================================================
function buildBodyContent() {
  const body = [];
  body.push(...buildExecSummary());
  body.push(...buildFeatureInventory());
  body.push(...buildHealthDashboard());
  body.push(...buildCostModel());
  body.push(...buildRiskAnalysis());
  body.push(...buildMitigationPlan());
  body.push(...buildFinalVerdict());
  return body;
}

// =============================================================================
// ASSEMBLE DOCUMENT
// =============================================================================
const doc = new Document({
  creator: "Super Z (SQA Architect)",
  title: "InventoryOS AI Features Report",
  description: "Status, Cost & Risk Assessment of AI Integration in InventoryOS",
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 22, color: c(P.body),
        },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 32, bold: true, color: c(P.primary),
        },
        paragraph: { spacing: { before: 360, after: 200, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 28, bold: true, color: c(P.primary),
        },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 24, bold: true, color: c(P.primary),
        },
        paragraph: { spacing: { before: 220, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // ===== SECTION 1: COVER (margin 0, no header/footer, no page number) =====
    {
      properties: {
        page: {
          size: pgSize,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    // ===== SECTION 2: TOC (Roman numerals, start at I) =====
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      headers: { default: buildHeader() },
      footers: { default: buildFooter("roman") },
      children: buildTocSection(),
    },
    // ===== SECTION 3: BODY (Arabic numerals, reset to 1) =====
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: buildHeader() },
      footers: { default: buildFooter("arabic") },
      children: buildBodyContent(),
    },
  ],
});

// =============================================================================
// EXPORT
// =============================================================================
const outputPath = "/home/z/my-project/download/InventoryOS_AI_Features_Report.docx";

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document generated: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch((err) => {
  console.error("Error generating document:", err);
  process.exit(1);
});
