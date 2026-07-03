/**
 * Unit tests for shelf scan JSON parser (no API key needed).
 * Run: node scripts/test-shelf-scan-parse.js
 */

const path = require("path");

// Minimal inline copy of parser logic for node test without tsx
function pickString(obj, keys) {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function itemToDetection(obj) {
  const brandName = pickString(obj, ["brand_name", "brandName", "brand", "name"]);
  const fullName = pickString(obj, ["full_name", "fullName"]);
  const name = fullName || brandName;
  if (!name) return null;
  return { name };
}

function parseSimple(raw) {
  const parsed = JSON.parse(raw);
  const arr = parsed.medicines || parsed.items || parsed;
  if (!Array.isArray(arr)) return [];
  return arr.map(itemToDetection).filter(Boolean);
}

const cases = [
  {
    name: "standard medicines array",
    raw: JSON.stringify({
      total_medicines_detected: 2,
      medicines: [
        { brand_name: "Napa", full_name: "Napa 500mg", confidence: "high" },
        { brand_name: "Seclo", full_name: "Seclo 20mg", confidence: "medium" },
      ],
    }),
    expect: 2,
  },
  {
    name: "camelCase fields",
    raw: JSON.stringify({
      medicines: [{ brandName: "Clovate", fullName: "Clovate Cream", confidence: "high" }],
    }),
    expect: 1,
  },
  {
    name: "items key",
    raw: JSON.stringify({
      items: [{ name: "Betameson", confidence: "low" }],
    }),
    expect: 1,
  },
  {
    name: "empty medicines",
    raw: JSON.stringify({ total_medicines_detected: 0, medicines: [] }),
    expect: 0,
  },
];

let passed = 0;
for (const c of cases) {
  const got = parseSimple(c.raw).length;
  if (got === c.expect) {
    console.log(`✓ ${c.name}`);
    passed++;
  } else {
    console.error(`✗ ${c.name}: expected ${c.expect}, got ${got}`);
    process.exit(1);
  }
}
console.log(`\n${passed}/${cases.length} parser smoke tests passed`);
