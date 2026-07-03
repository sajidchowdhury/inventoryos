import { parseShelfScanResponse } from "../src/lib/shelf-scan-parse";

const samples: Array<{ label: string; raw: string; expectMin: number }> = [
  {
    label: "standard JSON",
    raw: JSON.stringify({
      medicines: [
        { brand_name: "Napa", full_name: "Napa 500mg Tablet", confidence: "high" },
        { brand_name: "Seclo", full_name: "Seclo 20mg Capsule", confidence: "medium" },
      ],
    }),
    expectMin: 2,
  },
  {
    label: "markdown fenced",
    raw: '```json\n{"medicines":[{"brand_name":"Napa","full_name":"Napa 500mg","confidence":"high"}]}\n```',
    expectMin: 1,
  },
  {
    label: "truncated JSON regex salvage",
    raw: '{"medicines":[{"brand_name":"Clovate","full_name":"Clovate 0.05% Cream","confidence":"high"},{"brand_name":"Napa","full_name":"Napa 500mg Tablet","confiden',
    expectMin: 2,
  },
  {
    label: "plain text bullet list",
    raw: `Here are the medicines I can see on the shelf:
- Napa 500mg Tablet
- Seclo 20mg Capsule
- Clovate 0.05% Cream`,
    expectMin: 3,
  },
  {
    label: "numbered list",
    raw: `Medicines detected:
1. Betameson 0.1% Cream
2. Fusitop 2% Ointment`,
    expectMin: 2,
  },
  {
    label: "preamble before JSON",
    raw: `Based on the shelf photos, here is the analysis:
{"medicines":[{"brand_name":"De-rash","full_name":"De-rash Cream","confidence":"medium"}]}`,
    expectMin: 1,
  },
  {
    label: "JSON trailing comma",
    raw: '{"medicines":[{"brand_name":"Napa","full_name":"Napa 500mg",},]}',
    expectMin: 1,
  },
];

let ok = 0;
for (const s of samples) {
  const { detections, diagnostic } = parseShelfScanResponse(s.raw);
  if (detections.length >= s.expectMin) {
    console.log(`✓ ${s.label} (${diagnostic.parseMethod}, ${detections.length} found)`);
    ok++;
  } else {
    console.error(`✗ ${s.label}: expected >=${s.expectMin}, got ${detections.length}`, diagnostic);
    process.exit(1);
  }
}
console.log(`\n${ok}/${samples.length} parseShelfScanResponse tests passed`);
