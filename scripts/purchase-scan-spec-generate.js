// Purchase Scanner Plan — Main generator
// Output: /home/z/my-project/download/InventoryOS_Purchase_Scanner_Plan.docx

const H = require("/home/z/my-project/inventoryos/scripts/ai-report-helpers");
const {
  P, c, NB, noBorders, allNoBorders, tableBorders,
  Document, Packer, Paragraph, TextRun, Header, Footer,
  PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  SectionType, TableLayoutType, BorderStyle,
} = H;
const fs = require("fs");

const { buildCover } = require("/home/z/my-project/scripts/purchase-scan-spec-cover");
const { buildBody } = require("/home/z/my-project/scripts/purchase-scan-spec-body");

function bodyFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "InventoryOS \u2014 Purchase Scanner Plan  |  Page ", size: 18, color: c(P.secondary), font: { ascii: "Calibri" } }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary), font: { ascii: "Calibri" } }),
      ],
    })],
  });
}

function bodyHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 4 } },
      children: [new TextRun({
        text: "Purchase Sheet Scanner Plan",
        size: 18, italics: true, color: c(P.secondary), font: { ascii: "Calibri" },
      })],
    })],
  });
}

const doc = new Document({
  creator: "InventoryOS",
  title: "Purchase Sheet Scanner Plan",
  description: "Phased plan for AI vision purchase invoice scanning",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri" } } },
      heading2: { run: { bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri" } } },
      heading3: { run: { bold: true, size: 24, color: c(P.primary), font: { ascii: "Calibri" } } },
    },
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } },
        type: SectionType.NEXT_PAGE,
      },
      children: buildCover(),
    },
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
        type: SectionType.NEXT_PAGE,
      },
      headers: { default: bodyHeader() },
      footers: { default: bodyFooter() },
      children: buildBody(),
    },
  ],
});

const OUT = "/home/z/my-project/download/InventoryOS_Purchase_Scanner_Plan.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  const sizeKB = (buf.length / 1024).toFixed(1);
  console.log(`\u2705 Generated: ${OUT}`);
  console.log(`   Size: ${sizeKB} KB`);
}).catch((err) => {
  console.error("\u274c Generation failed:", err);
  process.exit(1);
});
