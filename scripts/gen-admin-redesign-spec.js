// Main orchestrator for Super Admin Panel Redesign Spec
const H = require("./ai-report-helpers");
const {
  P, c,
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType,
} = H;
const fs = require("fs");

const { buildCover } = require("./admin-redesign-cover");
const {
  buildProblemAnalysis, buildCronOptimization, buildMultiProjectArchitecture,
} = require("./admin-redesign-body1");
const {
  buildNavigationRedesign, buildApiSetupFirst, buildDynamicOwnerEmail, buildPhasedRoadmap,
} = require("./admin-redesign-body2");

const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function buildHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { line: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 4 } },
      children: [new TextRun({
        text: "Super Admin Panel Redesign \u2014 Architecture Spec",
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

function buildBodyContent() {
  const body = [];
  body.push(...buildProblemAnalysis());
  body.push(...buildCronOptimization());
  body.push(...buildMultiProjectArchitecture());
  body.push(...buildNavigationRedesign());
  body.push(...buildApiSetupFirst());
  body.push(...buildDynamicOwnerEmail());
  body.push(...buildPhasedRoadmap());
  return body;
}

const doc = new Document({
  creator: "Super Z (SQA Architect)",
  title: "Super Admin Panel Redesign Specification",
  description: "Multi-Project Architecture, Navigation Redesign & Cron Optimization",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 200, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 220, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    { properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } }, children: buildCover() },
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } } },
      headers: { default: buildHeader() }, footers: { default: buildFooter() },
      children: buildTocSection(),
    },
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: buildHeader() }, footers: { default: buildFooter() },
      children: buildBodyContent(),
    },
  ],
});

const outputPath = "/home/z/my-project/download/InventoryOS_Admin_Panel_Redesign_Spec.docx";

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document generated: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch((err) => { console.error("Error:", err); process.exit(1); });
