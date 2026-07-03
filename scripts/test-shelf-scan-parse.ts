import { parseShelfScanResponse } from "../src/lib/shelf-scan-parse";

const samples = [
  {
    label: "standard",
    raw: JSON.stringify({
      total_medicines_detected: 2,
      medicines: [
        { brand_name: "Napa", full_name: "Napa 500mg Tablet", confidence: "high" },
        { brand_name: "Seclo", full_name: "Seclo 20mg Capsule", confidence: "medium" },
      ],
    }),
    expect: 2,
  },
  {
    label: "camelCase",
    raw: JSON.stringify({
      medicines: [{ brandName: "Clovate", fullName: "Clovate 0.05% Cream", confidence: "high" }],
    }),
    expect: 1,
  },
  {
    label: "detected_medicines key",
    raw: JSON.stringify({
      detected_medicines: [{ medicine_name: "Fusitop", full_name: "Fusitop Cream", confidence: "low" }],
    }),
    expect: 1,
  },
  {
    label: "empty array",
    raw: JSON.stringify({ total_medicines_detected: 0, medicines: [] }),
    expect: 0,
  },
  {
    label: "markdown fenced",
    raw: '```json\n{"medicines":[{"brand_name":"Napa","full_name":"Napa","confidence":"high"}]}\n```',
    expect: 1,
  },
];

let ok = 0;
for (const s of samples) {
  const { detections, diagnostic } = parseShelfScanResponse(s.raw);
  if (detections.length === s.expect) {
    console.log(`✓ ${s.label}`);
    ok++;
  } else {
    console.error(`✗ ${s.label}: expected ${s.expect}, got ${detections.length}`, diagnostic);
    process.exit(1);
  }
}
console.log(`\n${ok}/${samples.length} parseShelfScanResponse tests passed`);
