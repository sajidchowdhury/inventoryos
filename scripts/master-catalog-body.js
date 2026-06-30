// Master Catalog Implementation Spec — Body
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildBody() {
  const out = [];

  // ═══════════════════════════════════════════════════════
  // 1. PROBLEM ANALYSIS
  // ═══════════════════════════════════════════════════════
  out.push(h1("1. Problem Analysis"));

  out.push(bodyPara(
    "Bangladesh has 300+ pharmaceutical manufacturing companies, each producing 500 to 2,000+ products. The total universe of pharmaceutical products in the country exceeds 300,000. However, no single pharmacy carries all of them. A typical pharmacy stocks products from 20 to 30 companies, selecting only 10 to 50 products from each \u2014 a total inventory of 200 to 800 products. This means each pharmacy uses less than 0.3 percent of the total product universe."
  ));

  out.push(bodyPara(
    "The current InventoryOS architecture has each pharmacy create their own Product records independently. Every pharmacy types in product names, generics, strengths, manufacturers, and categories from scratch. This creates four serious problems at scale."
  ));

  out.push(h2("1.1 The Data Entry Nightmare"));

  out.push(bodyPara(
    "If InventoryOS onboards 1,000 pharmacies, each with 400 products, that is 400,000 manual product entries across the platform. At 2 minutes per product (search for existing, type name, generic, strength, manufacturer, category, save), that is 13,333 hours of data entry \u2014 the equivalent of 6.5 full-time employees working for a year. No pharmacy owner will do this. They will abandon the platform before finishing even 50 products."
  ));

  out.push(h2("1.2 Data Inconsistency"));

  out.push(bodyPara(
    "When 1,000 pharmacies independently type product names, typos are inevitable. One pharmacy writes 'Napa Extra', another writes 'Napa Extar', a third writes 'Napa-Extra', a fourth writes 'Napa extra 500mg'. To the database, these are 4 different products. To a human, they are the same. This makes it impossible to aggregate sales data across pharmacies for the same product \u2014 which is critical for AI predictions ('last year Eid, Napa Extra spiked 340% across all pharmacies')."
  ));

  out.push(h2("1.3 Storage Waste"));

  out.push(bodyPara(
    "Each Product row in the current schema has ~20 fields (name, genericName, strength, dosageForm, manufacturer, scheduleType, hsnCode, vatRate, mrp, etc.). If 1,000 pharmacies each carry Napa Extra, that is 1,000 identical copies of the same 20-field row \u2014 only the inventory quantity differs. At 1KB per row, 400,000 rows = 400MB of redundant product metadata. Not catastrophic, but wasteful and slow to query."
  ));

  out.push(h2("1.4 AI Prediction Limitation"));

  out.push(bodyPara(
    "The AI report predictor currently looks at a single pharmacy's historical sales for each product. For a new pharmacy with 3 months of data, the prediction confidence is 'Low' because there is not enough history to detect occasion spikes. If all pharmacies used the same product identity (masterProductId), the predictor could aggregate sales across all pharmacies carrying that product \u2014 giving even new pharmacies accurate predictions based on the collective intelligence of the entire platform."
  ));

  out.push(calloutPara(
    "Example: City Pharmacy (new, 3 months of data) carries Napa Extra. With a master catalog, the AI can see that 50 other pharmacies on the platform sold 340% more Napa Extra during Eid last year. City Pharmacy gets an accurate Eid spike prediction on day one \u2014 even though they have no Eid history of their own. This is the network effect that makes the master catalog a competitive moat.",
    P.aiAccent
  ));

  // ═══════════════════════════════════════════════════════
  // 2. SOLUTION: TWO-TIER ARCHITECTURE
  // ═══════════════════════════════════════════════════════
  out.push(h1("2. Solution: Two-Tier Architecture"));

  out.push(bodyPara(
    "The solution is a two-tier product system that separates shared product metadata (the Master Catalog) from per-pharmacy inventory data (Pharmacy Inventory). This is the industry-standard approach used by major pharmacy platforms worldwide."
  ));

  out.push(h2("2.1 Tier 1: Master Catalog (Shared, Platform-Level)"));

  out.push(bodyPara(
    "A single central database containing ALL pharmaceutical products available in Bangladesh. This is reference data \u2014 pharmacies do not own these rows. The catalog is maintained by the platform admin (you) and sourced from the DGDA (Directorate General of Drug Administration) public drug registry or from pharmaceutical distributor product lists. Each product has a unique identity (DGDA registration number or auto-generated ID) and complete metadata: name, generic name, strength, dosage form, manufacturer, category, schedule type, HSN code, VAT rate, default MRP."
  ));

  out.push(h2("2.2 Tier 2: Pharmacy Inventory (Per-Business)"));

  out.push(bodyPara(
    "Each pharmacy subscribes to the products they carry. The subscription is lightweight \u2014 it only stores what is unique to that pharmacy: current stock quantity, reorder level, selling price (may differ from MRP), batch information, and rack location. The product name, generic, manufacturer, etc. are NOT duplicated \u2014 they live in the Master Catalog and are referenced via masterProductId."
  ));

  out.push(tableCaption("Table 2.1 \u2014 What Lives Where"));
  out.push(makeTable(
    ["Data Field", "Master Catalog (shared)", "Pharmacy Inventory (per-business)"],
    [
      ["Product name (e.g., Napa Extra)", "\u2713 Stored once", "Referenced via masterProductId"],
      ["Generic name (e.g., Paracetamol)", "\u2713 Stored once", "Referenced"],
      ["Strength (e.g., 500mg)", "\u2713 Stored once", "Referenced"],
      ["Dosage form (e.g., Tablet)", "\u2713 Stored once", "Referenced"],
      ["Manufacturer (e.g., Square)", "\u2713 Stored once", "Referenced"],
      ["Category (e.g., Pain & Fever)", "\u2713 Stored once", "Referenced"],
      ["DGDA registration number", "\u2713 Stored once", "Referenced"],
      ["Default MRP", "\u2713 Stored once", "Optional override per pharmacy"],
      ["Current stock quantity", "\u2717 Not stored", "\u2713 Per pharmacy"],
      ["Reorder level", "\u2717 Not stored", "\u2713 Per pharmacy"],
      ["Selling price (may differ from MRP)", "\u2717 Not stored", "\u2713 Per pharmacy"],
      ["Batch number + expiry date", "\u2717 Not stored", "\u2713 Per pharmacy (in Batch table)"],
      ["Rack location", "\u2717 Not stored", "\u2713 Per pharmacy"],
    ],
    [30, 35, 35]
  ));

  out.push(h2("2.3 How Onboarding Works for a New Pharmacy"));

  out.push(bodyPara(
    "Instead of typing 400 products manually, a new pharmacy owner opens the 'Add Products' page and sees a search bar connected to the master catalog. They search by company name (e.g., 'Square'), see all 1,000+ Square products listed, and check the 16 they carry. For each checked product, they enter their current stock and selling price. The entire onboarding takes 10 minutes instead of 10 hours. This is the single biggest UX improvement the platform can make."
  ));

  out.push(bodyPara(
    "Even better: the system can auto-suggest products based on the pharmacy's location and size. A pharmacy in Dhaka is likely to carry the same products as other Dhaka pharmacies. The system can show 'Products commonly carried by pharmacies in your area' as a pre-checked list, reducing the selection to just confirming/removing rather than searching from scratch."
  ));

  out.push(h2("2.4 How the AI Predictor Benefits"));

  out.push(bodyPara(
    "With a master catalog, the AI predictor gains two new capabilities. First, cross-pharmacy intelligence: instead of relying on a single pharmacy's Eid sales history, it can aggregate sales across all pharmacies carrying the same masterProductId during the same occasion window. This gives accurate predictions even for new pharmacies. Second, product-level trend detection: if a particular generic (e.g., Paracetamol) is trending upward across the platform, the predictor can flag all products containing that generic as 'likely to spike', even if the specific brand has no history."
  ));

  // ═══════════════════════════════════════════════════════
  // 3. DATA MODEL
  // ═══════════════════════════════════════════════════════
  out.push(h1("3. Data Model"));

  out.push(h2("3.1 New Model: MasterProduct"));

  out.push(bodyPara(
    "A new Prisma model that stores the shared product catalog. This is platform-level data \u2014 no businessId. Only the super admin can create/update/delete master products (via the super admin panel or CSV import)."
  ));

  out.push(tableCaption("Table 3.1 \u2014 MasterProduct Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["name", "String", "(required)", "Brand name (e.g., 'Napa Extra')"],
      ["genericName", "String?", "null", "Generic name (e.g., 'Paracetamol + Caffeine')"],
      ["strength", "String?", "null", "Strength (e.g., '500mg')"],
      ["dosageForm", "String?", "null", "Tablet, Capsule, Syrup, Injection, etc."],
      ["manufacturer", "String?", "null", "Company name (e.g., 'Square Pharmaceuticals')"],
      ["manufacturerCode", "String?", "null", "Short code (e.g., 'SQR') for quick search"],
      ["categoryName", "String?", "null", "Category (e.g., 'Pain & Fever')"],
      ["scheduleType", "String?", "null", "OTC, Schedule_H, Schedule_H1, Schedule_X, Narcotic"],
      ["hsnCode", "String?", "null", "HSN code for VAT"],
      ["vatRate", "Float", "0", "Default VAT percentage"],
      ["defaultMrp", "Float?", "null", "Default Maximum Retail Price"],
      ["dgdaRegNo", "String? @unique", "null", "DGDA registration number (unique identifier)"],
      ["barcode", "String?", "null", "Product barcode"],
      ["unit", "String", "'piece'", "Base unit: piece, tablet, ml, g"],
      ["stripSize", "Int?", "null", "Tablets per strip"],
      ["boxSize", "Int?", "null", "Strips per box"],
      ["isActive", "Boolean", "true", "Soft delete (set false to hide from catalog)"],
      ["createdAt", "DateTime", "now()", ""],
      ["updatedAt", "DateTime", "updatedAt", ""],
    ],
    [20, 16, 16, 48]
  ));

  out.push(h2("3.2 Updated Model: Product (Pharmacy Inventory)"));

  out.push(bodyPara(
    "The existing Product model is modified to add an optional masterProductId field. When set, the product metadata (name, generic, strength, etc.) is read from the MasterProduct. When null (for custom products not in the catalog), the pharmacy enters their own metadata as before. This is backward compatible \u2014 existing products continue to work with masterProductId=null."
  ));

  out.push(tableCaption("Table 3.2 \u2014 Product Model Changes (additions only)"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["masterProductId", "String?", "null", "FK to MasterProduct. Null = custom product (backward compatible)"],
      ["sellingPrice", "Float?", "null", "Pharmacy's selling price (may differ from MRP)"],
      ["rackNo", "String?", "null", "Already exists \u2014 moved here for clarity"],
    ],
    [20, 16, 16, 48]
  ));

  out.push(bodyPara(
    "When masterProductId is set, the following fields on Product become read-only (sourced from MasterProduct): name, genericName, strength, dosageForm, manufacturer, scheduleType, hsnCode, vatRate. The API returns these from the MasterProduct relation. When masterProductId is null, these fields are editable as before."
  ));

  out.push(h2("3.3 New Model: MasterManufacturer"));

  out.push(bodyPara(
    "A separate model for pharmaceutical manufacturers, so the catalog can be browsed by company. This enables the 'Browse by Company' UX where a pharmacy selects 'Square Pharmaceuticals' and sees all 1,000+ Square products."
  ));

  out.push(tableCaption("Table 3.3 \u2014 MasterManufacturer Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["name", "String @unique", "(required)", "Company name (e.g., 'Square Pharmaceuticals Ltd.')"],
      ["shortCode", "String?", "null", "Short code (e.g., 'SQR', 'BEX', 'REN')"],
      ["country", "String", "'Bangladesh'", "Country of origin"],
      ["isActive", "Boolean", "true", "Soft delete"],
      ["productCount", "Int", "0", "Cached count of products (updated on import)"],
      ["createdAt", "DateTime", "now()", ""],
      ["updatedAt", "DateTime", "updatedAt", ""],
    ],
    [20, 16, 16, 48]
  ));

  out.push(h2("3.4 Indexes for Performance"));

  out.push(bodyPara(
    "The MasterProduct table will have 300,000+ rows. Proper indexing is critical. Indexes on: name (text search), genericName (text search), manufacturer (filter), dgdaRegNo (exact lookup), barcode (exact lookup), categoryName (filter). The Product table gets an index on masterProductId for the reverse lookup (find which pharmacies carry a product)."
  ));

  // ═══════════════════════════════════════════════════════
  // 4. CATALOG DATA SOURCING
  // ═══════════════════════════════════════════════════════
  out.push(h1("4. Catalog Data Sourcing"));

  out.push(bodyPara(
    "The master catalog needs to be populated with 300,000+ products before it is useful. There are three approaches, in order of preference."
  ));

  out.push(h2("4.1 DGDA Public Drug Registry (Best)"));

  out.push(bodyPara(
    "The Directorate General of Drug Administration (DGDA) maintains a public registry of all registered pharmaceutical products in Bangladesh. The data is available at dgda.gov.bd and includes: product name, generic name, strength, dosage form, manufacturer, DGDA registration number, and approval date. This is the authoritative source \u2014 if a product is not in the DGDA registry, it is not legally sold in Bangladesh. The data can be scraped or requested via official channels. Estimated: 50,000 to 100,000 registered products (not 300,000 \u2014 many 'products' are the same drug in different pack sizes)."
  ));

  out.push(h2("4.2 Pharmaceutical Distributor Product Lists (Good)"));

  out.push(bodyPara(
    "Major pharmaceutical distributors (like Rahman Chemical, Medicinal Importers, etc.) maintain product catalogs with prices. These lists are available as Excel/CSV files and include: product name, generic, strength, manufacturer, pack size, trade price, MRP. The advantage over DGDA is that they include pricing. The disadvantage is that they are not comprehensive (only products that distributor carries). Multiple distributor lists can be merged to build a more complete catalog."
  ));

  out.push(h2("4.3 Crowdsourced from Pharmacies (Fallback)"));

  out.push(bodyPara(
    "As pharmacies onboard and enter custom products (masterProductId=null), the platform can aggregate these entries. When the same product name + generic + strength + manufacturer appears from 3+ pharmacies, the system auto-creates a MasterProduct entry and links all matching custom products to it. This is the slowest approach but requires no external data sourcing. It can be used in parallel with approaches 4.1 and 4.2 to fill gaps."
  ));

  out.push(h2("4.4 CSV Import Format"));

  out.push(bodyPara(
    "Regardless of the source, the catalog is imported via a CSV file with the following columns. The super admin uploads the CSV via the super admin panel, and the system bulk-inserts or updates MasterProduct rows."
  ));

  out.push(tableCaption("Table 4.1 \u2014 Master Catalog CSV Import Format"));
  out.push(makeTable(
    ["Column", "Required", "Example", "Notes"],
    [
      ["name", "Yes", "Napa Extra", "Brand name"],
      ["genericName", "No", "Paracetamol + Caffeine", "Generic composition"],
      ["strength", "No", "500mg", "Dosage strength"],
      ["dosageForm", "No", "Tablet", "Tablet/Capsule/Syrup/Injection/Cream/etc."],
      ["manufacturer", "Yes", "Square Pharmaceuticals", "Company name"],
      ["categoryName", "No", "Pain & Fever", "Pharmacy category"],
      ["scheduleType", "No", "OTC", "OTC/Schedule_H/Schedule_H1/Schedule_X/Narcotic"],
      ["dgdaRegNo", "No", "DGDA-12345", "Unique \u2014 used for deduplication"],
      ["barcode", "No", "8941234567890", "Product barcode"],
      ["defaultMrp", "No", "8.50", "Default MRP in BDT"],
      ["hsnCode", "No", "30049099", "HSN code for VAT"],
      ["vatRate", "No", "0", "VAT percentage"],
      ["unit", "No", "piece", "piece/tablet/ml/g"],
      ["stripSize", "No", "10", "Units per strip"],
      ["boxSize", "No", "10", "Strips per box"],
    ],
    [18, 10, 26, 46]
  ));

  // ═══════════════════════════════════════════════════════
  // 5. API ENDPOINTS
  // ═══════════════════════════════════════════════════════
  out.push(h1("5. API Endpoints"));

  out.push(h2("5.1 Super Admin Endpoints (Catalog Management)"));

  out.push(tableCaption("Table 5.1 \u2014 Super Admin Catalog Endpoints"));
  out.push(makeTable(
    ["Method", "Path", "Purpose"],
    [
      ["GET", "/api/super-admin/master-products", "List master products with pagination, search, filter by manufacturer/category"],
      ["POST", "/api/super-admin/master-products", "Create a single master product (manual entry)"],
      ["PUT", "/api/super-admin/master-products/[id]", "Update a master product"],
      ["DELETE", "/api/super-admin/master-products/[id]", "Soft delete (isActive=false)"],
      ["POST", "/api/super-admin/master-products/import", "Bulk CSV import. Body: { csv: '...' } or multipart file upload. Returns { imported, updated, skipped, errors }"],
      ["GET", "/api/super-admin/master-manufacturers", "List all manufacturers with product counts"],
      ["POST", "/api/super-admin/master-manufacturers", "Create a manufacturer"],
    ],
    [10, 40, 50]
  ));

  out.push(h2("5.2 Pharmacy Endpoints (Catalog Browsing + Subscription)"));

  out.push(tableCaption("Table 5.2 \u2014 Pharmacy Catalog Endpoints"));
  out.push(makeTable(
    ["Method", "Path", "Purpose"],
    [
      ["GET", "/api/businesses/[id]/catalog/search", "Search master catalog. Query: ?q=Napa&manufacturer=Square&category=Pain&limit=50. Returns matching MasterProducts with 'subscribed' boolean indicating if this pharmacy already carries it."],
      ["GET", "/api/businesses/[id]/catalog/browse", "Browse by manufacturer. Returns manufacturers with product counts. Query: ?manufacturerId=xxx for product list."],
      ["POST", "/api/businesses/[id]/catalog/subscribe", "Subscribe to products. Body: { productIds: ['id1','id2',...], defaultStock: 0, defaultReorderLevel: 10 }. Creates Product rows linked to MasterProducts."],
      ["POST", "/api/businesses/[id]/catalog/unsubscribe", "Unsubscribe. Body: { productIds: ['id1'] }. Sets Product.isActive=false (does not delete \u2014 preserves sales history)."],
    ],
    [10, 40, 50]
  ));

  out.push(h2("5.3 Search Performance"));

  out.push(bodyPara(
    "Searching 300,000+ products by name requires proper full-text search. SQLite has FTS5 (full-text search extension) which is fast for this scale. PostgreSQL has built-in full-text search with tsvector. The search endpoint uses WHERE name LIKE '%query%' for simple cases (acceptable up to 100K rows with proper indexing) and FTS5/tsvector for production at scale. The search also supports searching by generic name, manufacturer, DGDA reg number, and barcode \u2014 all indexed."
  ));

  // ═══════════════════════════════════════════════════════
  // 6. UI CHANGES
  // ═══════════════════════════════════════════════════════
  out.push(h1("6. UI Changes"));

  out.push(h2("6.1 Super Admin: Catalog Management Page"));

  out.push(bodyPara(
    "A new page at /admin/catalog (accessible from the sidebar) where the super admin manages the master catalog. Features: search bar (search 300K+ products), filter by manufacturer, filter by category, paginated table of master products, 'Import CSV' button (opens file picker, uploads CSV, shows progress), 'Add Product' button (manual entry form), edit/delete per product, manufacturer list with product counts."
  ));

  out.push(h2("6.2 Pharmacy App: New Product Onboarding Flow"));

  out.push(bodyPara(
    "The existing 'Add Product' form is replaced with a two-mode interface. Mode 1 (default): 'Search Catalog' \u2014 a search bar connected to the master catalog. The pharmacist types 'Napa' and sees all matching products from all manufacturers. Each result has a checkbox. The pharmacist checks the products they carry, enters stock + price, and clicks 'Add Selected'. Mode 2: 'Custom Product' \u2014 the old manual entry form (for products not in the catalog). A toggle at the top switches between modes."
  ));

  out.push(h2("6.3 Pharmacy App: Browse by Manufacturer"));

  out.push(bodyPara(
    "A 'Browse by Company' button on the product list page opens a manufacturer picker. The pharmacist selects 'Square Pharmaceuticals' and sees all 1,000+ Square products. Products they already carry are marked with a green checkmark. They check additional products to add, enter stock + price, and click 'Add Selected'. This is the fastest onboarding path for pharmacies that know their supplier list."
  ));

  // ═══════════════════════════════════════════════════════
  // 7. MIGRATION PLAN
  // ═══════════════════════════════════════════════════════
  out.push(h1("7. Migration Plan"));

  out.push(bodyPara(
    "Existing pharmacies already have Product records with manually entered metadata. The migration must link these existing products to MasterProduct entries where possible, without losing any data or breaking any functionality."
  ));

  out.push(h2("7.1 Automated Linking"));

  out.push(bodyPara(
    "A migration script runs through all existing Product records and attempts to match each one to a MasterProduct by: (1) exact DGDA reg number match (if available), (2) exact name + strength + manufacturer match, (3) fuzzy name match + same manufacturer (using Levenshtein distance). Matches with 95%+ confidence are auto-linked. Matches with 80-95% confidence are flagged for manual review. Products with no match remain as custom products (masterProductId=null) \u2014 they continue to work exactly as before."
  ));

  out.push(h2("7.2 Backward Compatibility"));

  out.push(bodyPara(
    "The migration is fully backward compatible. Products with masterProductId=null work exactly as before \u2014 all metadata is stored locally on the Product row. Products with masterProductId set read metadata from the MasterProduct relation. Both types coexist seamlessly. No existing functionality breaks."
  ));

  // ═══════════════════════════════════════════════════════
  // 8. PHASED IMPLEMENTATION ROADMAP
  // ═══════════════════════════════════════════════════════
  out.push(h1("8. Phased Implementation Roadmap"));

  out.push(bodyPara(
    "Four phases over 3 weeks. Each phase is independently shippable \u2014 the platform remains functional after every phase."
  ));

  out.push(h2("8.1 Phase 1 \u2014 Data Model + CSV Import (Week 1, 8 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Add MasterProduct + MasterManufacturer models, create the CSV import endpoint, and populate the catalog with initial data.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Add MasterProduct + MasterManufacturer to schema.prisma + migrate. (2) Add masterProductId to Product model (optional, null = backward compatible). (3) Build POST /api/super-admin/master-products/import (CSV parser, deduplication by dgdaRegNo, bulk upsert). (4) Build GET /api/super-admin/master-products (search + pagination). (5) Source initial catalog data (DGDA scrape or distributor Excel). (6) Import initial 50,000+ products via CSV. (7) Build basic catalog management UI in /admin/catalog.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Exit criteria: ", { bold: true, color: P.amber, size: 22 }),
    tr("Master catalog has 50,000+ products. Super admin can search, add, edit, and import via CSV. No changes to pharmacy app yet.", { size: 22 }),
  ]));

  out.push(h2("8.2 Phase 2 \u2014 Pharmacy Catalog Search + Subscribe (Week 2, 10 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Replace the manual 'Add Product' form with catalog search + subscribe. Pharmacies can browse 300K+ products and add them in seconds.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Build GET /api/businesses/[id]/catalog/search (search master catalog, mark subscribed products). (2) Build GET /api/businesses/[id]/catalog/browse (browse by manufacturer). (3) Build POST /api/businesses/[id]/catalog/subscribe (bulk create Product rows linked to MasterProducts). (4) Rebuild the Add Product UI with two modes: 'Search Catalog' (default) + 'Custom Product' (old form). (5) Build 'Browse by Company' UI. (6) Test with the demo pharmacy: search 'Square', subscribe to 16 products, verify they appear in the product list.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Exit criteria: ", { bold: true, color: P.amber, size: 22 }),
    tr("Pharmacy owner can search the catalog, check products, enter stock+price, and add them in under 10 minutes for 400 products. Custom product entry still works for products not in the catalog.", { size: 22 }),
  ]));

  out.push(h2("8.3 Phase 3 \u2014 Migration Script + Existing Data Linking (Week 2, 4 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Link existing manually-entered products to master catalog entries where possible.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Build scripts/migrate-to-master-catalog.js. (2) For each existing Product: try exact match (name+strength+manufacturer), then fuzzy match (Levenshtein >90%). (3) Auto-link high-confidence matches. (4) Generate a report of unlinked products for manual review. (5) Run on the demo pharmacy's 5 products as a test.", { size: 22 }),
  ]));

  out.push(h2("8.4 Phase 4 \u2014 AI Predictor Enhancement (Week 3, 6 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Enhance the AI report predictor to use cross-pharmacy aggregated data via masterProductId.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Update report-predictor.ts: when fetching historical sales, also query aggregated sales across ALL pharmacies for the same masterProductId during the same occasion window. (2) If the pharmacy has <90 days of own data, use cross-pharmacy data as the primary signal. (3) Update prediction confidence: 'High' if cross-pharmacy data available, 'Medium' if own data available, 'Low' if neither. (4) Add 'cross-pharmacy insight' section to the report: 'Based on 50 pharmacies carrying this product, Eid typically increases sales by 340%.' (5) Test: generate a report for the demo pharmacy and verify cross-pharmacy data is used.", { size: 22 }),
  ]));

  out.push(h2("8.5 Roadmap Summary"));

  out.push(tableCaption("Table 8.1 \u2014 Master Catalog Implementation Roadmap"));
  out.push(makeTable(
    ["Phase", "Goal", "Week", "Effort", "Gate"],
    [
      ["Phase 1", "Data model + CSV import + initial catalog", "1", "8 hours", "50K+ products in catalog, admin can search/import"],
      ["Phase 2", "Pharmacy catalog search + subscribe UI", "2", "10 hours", "Pharmacy adds 400 products in 10 min via catalog"],
      ["Phase 3", "Migration script (link existing products)", "2", "4 hours", "Existing products auto-linked where possible"],
      ["Phase 4", "AI predictor cross-pharmacy enhancement", "3", "6 hours", "New pharmacies get accurate predictions on day 1"],
    ],
    [10, 30, 10, 12, 38]
  ));

  out.push(bodyPara(
    "Total: 28 hours over 3 weeks. The most impactful phase is Phase 2 \u2014 it transforms the pharmacy onboarding experience from hours to minutes. Phase 4 is the strategic moat \u2014 cross-pharmacy intelligence makes the platform more valuable with each new pharmacy that joins."
  ));

  out.push(calloutPara(
    "The master catalog is not just a data management optimization \u2014 it is a competitive moat. Every pharmacy that joins makes the AI predictions better for all other pharmacies. No competitor without a master catalog can replicate this network effect. Build it early, build it right.",
    P.aiAccent
  ));

  // ═══════════════════════════════════════════════════════
  // 9. COST & PERFORMANCE ANALYSIS
  // ═══════════════════════════════════════════════════════
  out.push(h1("9. Cost & Performance Analysis"));

  out.push(h2("9.1 Storage Impact"));

  out.push(bodyPara(
    "MasterProduct table with 300,000 rows at ~1KB per row = ~300MB. This is trivial for SQLite (dev) and PostgreSQL (production). The Product table (pharmacy inventory) shrinks because metadata is no longer duplicated \u2014 each row is ~200 bytes instead of ~1KB. At 1,000 pharmacies \u00d7 400 products = 400,000 Product rows \u00d7 200 bytes = 80MB (was 400MB). Net storage change: +300MB (catalog) - 320MB (deduplicated metadata) = approximately zero net change."
  ));

  out.push(h2("9.2 Search Performance"));

  out.push(bodyPara(
    "Searching 300,000 rows with LIKE '%query%' takes 50-200ms on SQLite (acceptable for a search-as-you-type UX with debounce). On PostgreSQL with a GIN index on name, it takes 5-20ms. For production at scale (10,000+ pharmacies all searching simultaneously), a dedicated search engine like MeiliSearch or Typesense can be added \u2014 but this is not needed until 1,000+ concurrent users."
  ));

  out.push(h2("9.3 AI Prediction Performance"));

  out.push(bodyPara(
    "Cross-pharmacy aggregation adds one extra query per product in the prediction: 'SELECT SUM(quantity) FROM SaleItem WHERE masterProductId = X AND createdAt BETWEEN occasionStart AND occasionEnd'. With 400 products per pharmacy and an indexed masterProductId column, this adds ~400 indexed queries \u2014 approximately 200ms total. Acceptable within the current 5-30 second AI report generation time."
  ));

  return out;
}

module.exports = { buildBody };
