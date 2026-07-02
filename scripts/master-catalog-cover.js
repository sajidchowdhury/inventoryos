// Master Catalog Implementation Spec — Cover
const H = require("./ai-report-helpers");
const {
  P, c, NB, noBorders, allNoBorders,
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType, TableLayoutType,
} = H;

function buildCover() {
  const Pc = P.cover;
  const padL = 1200, padR = 800;
  const titleLines = ["InventoryOS", "Master Product Catalog", "Implementation Spec"];
  const titlePt = 32;
  const titleSize = titlePt * 2;
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(Pc.accent), space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: 3000 }, children: [] }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { after: 500, line: 360, lineRule: "atLeast" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(Pc.accent), space: 8 } },
    children: [new TextRun({
      text: "A R C H I T E C T U R E   S P E C   /   J U N E   2 0 2 6",
      size: 18, color: c(Pc.accent), bold: true,
      font: { ascii: "Calibri" }, characterSpacing: 40,
    })],
  }));

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 320,
        line: Math.ceil(titlePt * 23), lineRule: "atLeast",
      },
      children: [new TextRun({
        text: titleLines[i],
        size: titleSize, bold: true, color: c(Pc.titleColor),
        font: { ascii: "Arial" },
      })],
    }));
  }

  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 240, line: 360, lineRule: "atLeast" },
    children: [new TextRun({
      text: "Solving the 300,000-Product Data Problem for Bangladesh Pharmacies",
      size: 24, color: c(Pc.subtitleColor),
      font: { ascii: "Arial" },
    })],
  }));

  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 900, line: 320, lineRule: "atLeast" },
    children: [new TextRun({
      text: "Shared catalog + pharmacy subscriptions = 10-minute onboarding instead of 10-hour data entry",
      size: 22, italics: true, color: c(Pc.metaColor),
      font: { ascii: "Arial" },
    })],
  }));

  const metaLines = [
    "300+ pharmaceutical companies \u00b7 300,000+ products in the universe",
    "Each pharmacy carries ~400 products (0.13% of total)",
    "Two-tier architecture: Master Catalog + Pharmacy Inventory",
    "4 implementation phases over 3 weeks",
  ];
  for (const line of metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 },
      spacing: { after: 100, line: 320 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 22, color: c(Pc.metaColor),
        font: { ascii: "Arial" },
      })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(Pc.accent), space: 8 } },
    spacing: { before: 200, line: 320 },
    children: [
      new TextRun({ text: "Prepared by: Super Z (SQA Architect)", size: 16, color: c(Pc.footerColor), font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        ", size: 16, color: c(Pc.footerColor) }),
      new TextRun({ text: "Founder + Developer Reference", size: 16, color: c(Pc.footerColor), font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: c(Pc.bg) },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

module.exports = { buildCover };
