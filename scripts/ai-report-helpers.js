// InventoryOS AI Features Report — DOCX Generator
// Style: Emerald Pharmacy (matches app brand)
// Audience: Founder
// Sections: Cover + TOC + Executive Summary + 6 body sections

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType, TableLayoutType,
  LevelFormat, HeightRule,
} = require("docx");
const fs = require("fs");
const path = require("path");

// =============================================================================
// PALETTE — Emerald Pharmacy (matches InventoryOS app brand)
// =============================================================================
const P = {
  // Cover palette (dark emerald background)
  cover: {
    bg: "062F23",            // dark forest emerald
    titleColor: "FFFFFF",
    subtitleColor: "A7E3C6",
    metaColor: "E8F5EE",
    accent: "10B981",        // emerald-500
    footerColor: "9CA3AF",
  },
  // Body palette
  primary: "064E3B",          // emerald-900
  body: "1F2937",             // gray-800
  secondary: "6B7280",        // gray-500
  accent: "10B981",           // emerald-500
  aiAccent: "8B5CF6",         // violet-500 (AI feature highlight)
  surface: "F0FDF4",          // emerald-50
  amber: "F59E0B",
  rose: "F43F5E",
  white: "FFFFFF",
  border: "D1D5DB",
};

const c = (hex) => hex.replace("#", "");

// =============================================================================
// BORDER PRESETS
// =============================================================================
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 6, color: P.accent },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" },
  insideVertical: { style: BorderStyle.NONE },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function safeText(value, placeholder) {
  if (value === undefined || value === null || value === "" ||
      String(value) === "NaN" || String(value) === "undefined") {
    return placeholder || "[Please fill in]";
  }
  return String(value);
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { line: 312, before: opts.before || 0, after: opts.after || 120 },
    indent: opts.indent !== undefined ? opts.indent : { firstLine: 0 },
    children: [new TextRun({
      text: safeText(text),
      size: 22,
      color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function bodyParaRich(runs, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { line: 312, before: opts.before || 0, after: opts.after || 120 },
    indent: opts.indent !== undefined ? opts.indent : {},
    children: runs,
  });
}

function tr(text, opts = {}) {
  return new TextRun({
    text: safeText(text),
    size: opts.size || 22,
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: c(opts.color || P.body),
    font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200, line: 312 },
    children: [new TextRun({
      text: safeText(text),
      size: 32, bold: true, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140, line: 312 },
    children: [new TextRun({
      text: safeText(text),
      size: 28, bold: true, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100, line: 312 },
    children: [new TextRun({
      text: safeText(text),
      size: 24, bold: true, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function calloutPara(text, color = P.accent) {
  // A highlighted paragraph with left accent border
  return new Paragraph({
    spacing: { before: 160, after: 160, line: 312 },
    indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: c(color), space: 12 } },
    children: [new TextRun({
      text: safeText(text),
      size: 22, italics: true, color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function bulletItem(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({
      text: safeText(text),
      size: 22, color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function tableCaption(text) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({
      text: safeText(text),
      size: 21, bold: true, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function figureCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 240 },
    children: [new TextRun({
      text: safeText(text),
      size: 20, italics: true, color: c(P.secondary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

// Table cell builder
function tcell(text, opts = {}) {
  const isHeader = opts.header || false;
  const fillColor = opts.fill || (isHeader ? P.primary : null);
  const textColor = opts.color || (isHeader ? P.white : P.body);
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: fillColor ? { type: ShadingType.CLEAR, fill: c(fillColor) } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { line: 280 },
      children: [new TextRun({
        text: safeText(text),
        size: opts.size || 20,
        bold: isHeader || opts.bold || false,
        color: c(textColor),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    })],
  });
}

// Rich table cell (multiple text runs)
function tcellRich(runs, opts = {}) {
  const isHeader = opts.header || false;
  const fillColor = opts.fill || (isHeader ? P.primary : null);
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: fillColor ? { type: ShadingType.CLEAR, fill: c(fillColor) } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { line: 280 },
      children: runs,
    })],
  });
}

function makeTable(headers, rows, colWidths) {
  // colWidths: array of percentages summing to 100
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => tcell(h, {
      header: true,
      width: colWidths[i],
      align: AlignmentType.CENTER,
      size: 20,
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((cellData, ci) => {
      const opts = { width: colWidths[ci] };
      // Allow cell to be either string or {text, fill, color, bold}
      if (typeof cellData === "string") {
        return tcell(cellData, opts);
      }
      return tcell(cellData.text, {
        ...opts,
        fill: cellData.fill,
        color: cellData.color,
        bold: cellData.bold,
        align: cellData.align,
      });
    }),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    rows: [headerRow, ...dataRows],
  });
}

// Spacer paragraph (for breathing room)
function spacer(twips = 200) {
  return new Paragraph({
    spacing: { before: 0, after: twips, line: 240 },
    children: [new TextRun({ text: "" })],
  });
}

// Embed image preserving aspect ratio
function imageBlock(filepath, displayWidth = 540) {
  const buf = fs.readFileSync(filepath);
  // Get image dimensions via simple PNG header parse
  let aspect = 0.55;  // default 11:20 (h/w)
  if (filepath.endsWith(".png")) {
    // PNG: bytes 16-24 = width/height as big-endian uint32
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w > 0 && h > 0) aspect = h / w;
  }
  const displayHeight = Math.round(displayWidth * aspect);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new ImageRun({
      data: buf,
      transformation: { width: displayWidth, height: displayHeight },
      type: "png",
    })],
  });
}

module.exports = {
  P, c, NB, noBorders, allNoBorders, tableBorders,
  safeText, bodyPara, bodyParaRich, tr, h1, h2, h3,
  calloutPara, bulletItem, tableCaption, figureCaption,
  tcell, tcellRich, makeTable, spacer, imageBlock,
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType, TableLayoutType,
};
