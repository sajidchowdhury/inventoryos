// Cover builder for InventoryOS AI Features Report
// Uses R1 (Pure Paragraph Cover) recipe from design-system.md
const H = require("./ai-report-helpers");
const {
  P, c, NB, noBorders, allNoBorders,
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType, TableLayoutType,
} = H;

function buildCover() {
  const Pc = P.cover;
  const padL = 1200, padR = 800;

  // Manual title layout — "InventoryOS AI Features Report" fits in 2 lines at 36pt
  const titleLines = ["InventoryOS", "AI Features Report"];
  const titlePt = 36;
  const titleSize = titlePt * 2;

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(Pc.accent), space: 12 };

  const children = [];

  // 1. Top whitespace (~3500 twips)
  children.push(new Paragraph({ spacing: { before: 3200 }, children: [] }));

  // 2. English label with accent bottom border
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { after: 500, line: 360, lineRule: "atLeast" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(Pc.accent), space: 8 } },
    children: [new TextRun({
      text: "F O U N D E R   B R I E F I N G   /   J U N E   2 0 2 6",
      size: 18, color: c(Pc.accent), bold: true,
      font: { ascii: "Calibri" }, characterSpacing: 40,
    })],
  }));

  // 3. Main title (2 lines, dynamic font size)
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

  // 4. Subtitle
  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 240, line: 360, lineRule: "atLeast" },
    children: [new TextRun({
      text: "Status, Cost & Risk Assessment of AI Integration",
      size: 26, color: c(Pc.subtitleColor),
      font: { ascii: "Arial" },
    })],
  }));

  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 900, line: 320, lineRule: "atLeast" },
    children: [new TextRun({
      text: "Will AI burn through the budget, or power the product?",
      size: 22, italics: true, color: c(Pc.metaColor),
      font: { ascii: "Arial" },
    })],
  }));

  // 5. Meta info lines with left accent border
  const metaLines = [
    "Provider: Z.ai GLM-4",
    "AI Features Audited: 6  (4 LLM + 2 deterministic)",
    "Worst-case cost per pharmacy: 150 BDT / month",
    "Kill-switch threshold: 100,000 BDT / month platform-wide",
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

  // 6. Bottom whitespace (dynamic)
  children.push(new Paragraph({ spacing: { before: 2200 }, children: [] }));

  // 7. Footer with top accent separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(Pc.accent), space: 8 } },
    spacing: { before: 200, line: 320 },
    children: [
      new TextRun({
        text: "Prepared by: Super Z (SQA Architect)",
        size: 16, color: c(Pc.footerColor), font: { ascii: "Arial" },
      }),
      new TextRun({
        text: "                                        ",
        size: 16, color: c(Pc.footerColor),
      }),
      new TextRun({
        text: "Confidential — Internal Use",
        size: 16, color: c(Pc.footerColor), font: { ascii: "Arial" },
      }),
    ],
  }));

  // Single 16838 wrapper — the ONLY table
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
