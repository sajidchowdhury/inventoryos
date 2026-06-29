// Main orchestrator for InventoryOS Complete Feature Catalog
const H = require("./ai-report-helpers");
const {
  P, c,
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType,
} = H;
const fs = require("fs");

const { buildCover } = require("./feature-catalog-cover");
const {
  buildHowToUse, buildPart1Divider, buildTechFoundation,
  buildAuthSection, buildDBCacheSection,
} = require("./feature-catalog-body1");
const {
  buildAIInfraSection, buildBackgroundJobsSection,
  buildDevOpsSection, buildSecuritySection,
} = require("./feature-catalog-body2");
const {
  buildPart2Divider, buildProductInventorySection,
  buildSalesSection, buildPurchasesSection,
} = require("./feature-catalog-body3");
const {
  buildDashboardsSection, buildReportsSection, buildExpirySection,
  buildAIFeaturesSection, buildAlertsSection, buildUserSubSection,
  buildAuditFinalSection, buildSummarySection,
} = require("./feature-catalog-body4");

// =============================================================================
// PAGE LAYOUT
// =============================================================================
const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

// =============================================================================
// HEADER / FOOTER
// =============================================================================
function buildHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { line: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 4 } },
      children: [new TextRun({
        text: "InventoryOS Feature Catalog",
        size: 18, color: c(P.secondary), italics: true,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    })],
  });
}

function buildFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 },
      children: [new TextRun({
        children: [PageNumber.CURRENT],
        size: 18, color: c(P.secondary),
        font: { ascii: "Calibri" },
      })],
    })],
  });
}

// =============================================================================
// TOC SECTION
// =============================================================================
function buildTocSection() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360, line: 360 },
      children: [new TextRun({
        text: "Table of Contents",
        bold: true, size: 36, color: c(P.primary),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 240, after: 0, line: 312 },
      children: [new TextRun({
        text: "Note: This Table of Contents is generated via field codes. To refresh page numbers after editing, right-click the TOC and select \"Update Field.\"",
        italics: true, size: 18, color: c(P.secondary),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    }),
    new Paragraph({ children: [new (require("docx").PageBreak)()] }),
  ];
}

// =============================================================================
// BUILD BODY
// =============================================================================
function buildBodyContent() {
  const body = [];
  body.push(...buildHowToUse());

  // Part 1: Technical
  body.push(...buildPart1Divider());
  body.push(...buildTechFoundation());
  body.push(...buildAuthSection());
  body.push(...buildDBCacheSection());
  body.push(...buildAIInfraSection());
  body.push(...buildBackgroundJobsSection());
  body.push(...buildDevOpsSection());
  body.push(...buildSecuritySection());

  // Part 2: Business
  body.push(...buildPart2Divider());
  body.push(...buildProductInventorySection());
  body.push(...buildSalesSection());
  body.push(...buildPurchasesSection());
  body.push(...buildDashboardsSection());
  body.push(...buildReportsSection());
  body.push(...buildExpirySection());
  body.push(...buildAIFeaturesSection());
  body.push(...buildAlertsSection());
  body.push(...buildUserSubSection());
  body.push(...buildAuditFinalSection());
  body.push(...buildSummarySection());

  return body;
}

// =============================================================================
// ASSEMBLE DOCUMENT
// =============================================================================
const doc = new Document({
  creator: "Super Z (SQA Architect)",
  title: "InventoryOS Complete Feature Catalog",
  description: "Technical and Business Features Reference Document",
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
    // Section 1: Cover
    {
      properties: {
        page: {
          size: pgSize,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    // Section 2: TOC (Roman numerals)
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
      footers: { default: buildFooter() },
      children: buildTocSection(),
    },
    // Section 3: Body (Arabic, reset to 1)
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
      footers: { default: buildFooter() },
      children: buildBodyContent(),
    },
  ],
});

const outputPath = "/home/z/my-project/download/InventoryOS_Feature_Catalog.docx";

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document generated: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch((err) => {
  console.error("Error generating document:", err);
  process.exit(1);
});
