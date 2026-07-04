// InventoryOS — Purchase Sheet Scanner Enhancement Plan
// Style: Emerald Pharmacy (reuses ai-report-helpers.js patterns)
// Output: download/InventoryOS_Purchase_Scanner_Plan.docx

const H = require("/home/z/my-project/inventoryos/scripts/ai-report-helpers");
const {
  P, c, NB, noBorders, allNoBorders, tableBorders,
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType, TableLayoutType,
} = H;
const fs = require("fs");

// ─── Cover builder (R1 emerald pharmacy) ────────────────────────────────────
function buildCover() {
  const Pc = P.cover;
  const padL = 1200, padR = 800;
  const titleLines = ["Purchase Sheet", "Scanner Plan"];
  const titlePt = 36;
  const titleSize = titlePt * 2;
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(Pc.accent), space: 12 };

  const children = [];
  children.push(new Paragraph({ spacing: { before: 3200 }, children: [] }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { after: 500, line: 360, lineRule: "atLeast" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(Pc.accent), space: 8 } },
    children: [new TextRun({
      text: "P R O D U C T   S P E C   /   J U L Y   2 0 2 6",
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
      text: "Scan supplier invoices to auto-fill purchase items — no more one-by-one entry",
      size: 26, color: c(Pc.subtitleColor),
      font: { ascii: "Arial" },
    })],
  }));

  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 900, line: 320, lineRule: "atLeast" },
    children: [new TextRun({
      text: "One image at a time, accumulate into cart — matches proven shelf scanner pattern",
      size: 22, italics: true, color: c(Pc.metaColor),
      font: { ascii: "Arial" },
    })],
  }));

  const metaLines = [
    "Module: Pharmacy \u2192 Purchases",
    "Features planned: 4 (vision scan + catalog match + scanner UI + review polish)",
    "Phases: 4 (P1 \u2014 P4), each ~1\u20132 implementation sessions",
    "Tracking file: PROJECT_CONTEXT.md \u00a717 (added after this spec)",
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

  children.push(new Paragraph({ spacing: { before: 2200 }, children: [] }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(Pc.accent), space: 8 } },
    spacing: { before: 200, line: 320 },
    children: [
      new TextRun({ text: "Prepared by: Super Z", size: 16, color: c(Pc.footerColor), font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        ", size: 16, color: c(Pc.footerColor) }),
      new TextRun({ text: "Confidential \u2014 Internal Use", size: 16, color: c(Pc.footerColor), font: { ascii: "Arial" } }),
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
