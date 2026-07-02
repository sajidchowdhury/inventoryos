// scripts/import-master-catalog.js
// Reads download/master_catalog_import.csv and imports all 14K products
// via the import API endpoint.
//
// Usage: node scripts/import-master-catalog.js

const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "download", "master_catalog_import.csv");
const API_URL = "http://localhost:3001";

async function main() {
  console.log("=== Master Catalog Import ===\n");

  // Read CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV not found:", CSV_PATH);
    process.exit(1);
  }
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  console.log(`CSV loaded: ${csv.split("\n").length - 1} rows`);

  // Login as super admin
  console.log("Logging in...");
  const loginRes = await fetch(`${API_URL}/api/super-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "superadmin", password: "admin123" }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) { console.error("Login failed:", loginData); process.exit(1); }
  console.log("Logged in.");

  // Import
  console.log("Importing 14K products (this may take 1-2 minutes)...\n");
  const start = Date.now();

  const res = await fetch(`${API_URL}/api/super-admin/master-products/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ csv }),
  });

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (data.success) {
    console.log(`\n✅ Import complete in ${elapsed}s!`);
    console.log(`   New:      ${data.imported}`);
    console.log(`   Updated:  ${data.updated}`);
    console.log(`   Skipped:  ${data.skipped}`);
    if (data.totalErrors > 0) {
      console.log(`   Errors:   ${data.totalErrors}`);
      data.errors.forEach(e => console.log(`     ${e}`));
    }
  } else {
    console.error("❌ Import failed:", data.error);
    process.exit(1);
  }

  // Verify
  console.log("\nVerifying...");
  const verifyRes = await fetch(`${API_URL}/api/super-admin/master-products?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifyData = await verifyRes.json();
  console.log(`Total products in catalog: ${verifyData.total}`);
  console.log(`Manufacturers: ${(await (await fetch(`${API_URL}/api/super-admin/master-manufacturers`, { headers: { Authorization: `Bearer ${token}` } })).json()).total}`);
  console.log("\nSample products:");
  for (const p of verifyData.products) {
    console.log(`  ${p.name} | ${p.genericName || "?"} | ${p.strength || "?"} | ${p.dosageForm || "?"} | ${p.manufacturerStr || "?"}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
