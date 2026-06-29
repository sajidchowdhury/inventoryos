// Feature Catalog Body Part 3: Part 2 Divider + Product/Inventory + Sales + Purchases
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType, PageBreak,
} = H;

function buildPart2Divider() {
  const out = [];
  out.push(new Paragraph({
    children: [new PageBreak()],
  }));

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 3600, after: 480, line: 720, lineRule: "atLeast" },
    children: [new TextRun({
      text: "PART 2",
      size: 36, bold: true, color: c(P.aiAccent),
      font: { ascii: "Calibri" }, characterSpacing: 80,
    })],
  }));

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600, line: 720, lineRule: "atLeast" },
    children: [new TextRun({
      text: "Business Features",
      size: 56, bold: true, color: c(P.primary),
      font: { ascii: "Calibri" },
    })],
  }));

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    border: { bottom: { style: H.BorderStyle.SINGLE, size: 12, color: c(P.aiAccent), space: 8 } },
    indent: { left: 3000, right: 3000 },
    children: [],
  }));

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, lineRule: "atLeast" },
    indent: { left: 1800, right: 1800 },
    children: [new TextRun({
      text: "This section catalogs every capability the pharmacy owner GETS \u2014 what they can do in the app on a daily basis. These are the value propositions you can highlight in sales pitches, marketing materials, and client demos.",
      size: 22, italics: true, color: c(P.body),
      font: { ascii: "Calibri" },
    })],
  }));

  return out;
}

function buildProductInventorySection() {
  const out = [];
  out.push(h1("8. Product & Inventory Management"));

  out.push(bodyPara(
    "Product and inventory management is the core of InventoryOS. The system tracks products at two levels: the Product master (the drug's identity \u2014 name, generic, strength, dosage form) and the Batch (a specific shipment of that product with its own batch number, manufacture date, expiry date, and quantity). This two-level model is essential for pharmacies because the same product can have multiple batches with different expiry dates, and FEFO (First-Expiry-First-Out) dispensing requires tracking each batch separately."
  ));

  out.push(h2("8.1 Product Master with Pharmacy-Specific Fields"));

  out.push(bodyPara(
    "The Product model captures every field a pharmacy needs. Beyond the basics (name, generic, manufacturer, barcode, description), it tracks pharmacy-specific fields: strength (e.g., 500mg), dosage form (tablet, capsule, syrup, injection, etc.), schedule type (OTC, H, H1, X, Narcotic \u2014 the Bangladesh drug scheduling system), HSN code (for GST/VAT compliance), VAT rate, MRP (maximum retail price), Rx flag (prescription required), storage condition (room temperature, refrigerated, frozen), rack number (for physical location in the pharmacy), strip size and box size (for unit conversion), and min/max/reorder levels (for stock alerts)."
  ));

  out.push(h2("8.2 Product List & Search"));

  out.push(bodyPara(
    "The ProductList component provides a fast, filterable list of all products. Search works across name, generic name, manufacturer, barcode, and rack number \u2014 so a pharmacist can find a product by typing any of these. Category chip filters allow narrowing by category (Antibiotics, Analgesics, etc.). Pagination handles large inventories smoothly. Each product row shows the name, generic, stock status (in stock, low stock, out of stock), and quick actions (edit, delete, view detail)."
  ));

  out.push(h2("8.3 Product Detail View"));

  out.push(bodyPara(
    "Clicking a product opens the ProductDetail view, which shows the complete product information plus stock summary cards (total quantity, batch count, expired batch count, near-expiry batch count), low-stock and out-of-stock warnings, and the full list of batches for this product with their expiry severity color-coded. Per-batch actions are available: Stock In, Stock Out, Edit, Delete. This is the primary screen a pharmacist uses to manage a single product's lifecycle."
  ));

  out.push(h2("8.4 Category Management with Hierarchy"));

  out.push(bodyPara(
    "Categories support hierarchy (parent/child relationships), color coding, icons, and types. The CategoryManager UI allows creating, editing, and deleting categories with a color picker, icon selector, type field, and parent selector (which excludes the current category to prevent circular hierarchy). The delete operation has a safety check: it blocks deletion if the category has products or subcategories, preventing accidental orphaning of products."
  ));

  out.push(h2("8.5 Batch Tracking with Auto-Status"));

  out.push(bodyPara(
    "Each batch tracks: batch number, manufacture date, expiry date, quantity, purchase price, MRP, supplier link, status (active, near_expiry, expired, quarantined, returned, destroyed), and notes. The status is automatically calculated on every read and write: expired if expiry date is in the past, near_expiry if expiry is within 90 days, active otherwise. Quarantined, returned, and destroyed statuses are set explicitly by user actions. Duplicate batch prevention is enforced via a compound unique constraint on (businessId, batchNo, productId) \u2014 the same batch number can exist for different products, but not twice for the same product."
  ));

  out.push(h2("8.6 Stock Adjustments"));

  out.push(bodyPara(
    "Stock adjustments come in four types: STOCK_IN (receiving new stock), STOCK_OUT (manual removal, e.g., sample given to doctor), WASTE (damaged or spoiled), and RETURN (returned to supplier). Each adjustment requires a reason (selected from predefined chips), supports quick-amount buttons (10, 50, 100, All), shows a live preview of the resulting quantity, and validates against insufficient stock. Every adjustment writes a Transaction audit trail row with the type, quantity, unitPrice, note, and createdBy user ID."
  ));

  out.push(h2("8.7 FEFO Allocation Engine"));

  out.push(bodyPara(
    "The FEFO (First-Expiry-First-Out) allocation engine is the heart of the pharmacy inventory system. When a sale or dispense operation needs to deduct stock, the engine automatically picks the batch with the earliest expiry date first, skipping any expired or quarantined batches. The engine supports both dry-run mode (returns what would be allocated, without modifying stock) and execute mode (actually deducts stock). If insufficient stock is available, it returns a 409 response with the shortfall amount, allowing the UI to show the user exactly how much is missing. Manual batch override is supported but requires a reason (minimum 10 characters) and creates a FefoOverride audit trail row for DGDA compliance."
  ));

  out.push(h2("8.8 Quarantine, Dispose, and Return Workflows"));

  out.push(bodyPara(
    "Three workflows handle problematic batches. Quarantine (5 reasons: damaged, suspected counterfeit, recall, quality_issue, other) removes a batch from FEFO rotation and creates a NotificationLog entry so the staff is aware. Dispose (5 reasons + 5 disposal methods: landfill, incineration, return_to_supplier, sewer, other) handles end-of-life disposal with an optional witness name field for regulatory compliance \u2014 many jurisdictions require a witness for narcotic disposal. Return-to-supplier records the return with supplier name, reason, and quantity (defaulting to the full batch quantity, but partial returns are supported). All three workflows support partial quantities and write to the Transaction audit trail."
  ));

  out.push(h2("8.9 Bulk Batch Actions"));

  out.push(bodyPara(
    "For pharmacies with hundreds of batches, the BulkActionBar component allows applying actions (quarantine, dispose, return, release, delete) to multiple batches at once. The user selects batches via checkboxes, then clicks the action button. This is particularly useful when a supplier issues a recall \u2014 the pharmacist can quarantine all affected batches in one operation rather than handling them individually."
  ));

  out.push(tableCaption("Table 8.1 \u2014 Product & Inventory Feature Summary"));
  out.push(makeTable(
    ["Feature", "What the User Can Do"],
    [
      ["Product master", "Create/edit products with 20+ pharmacy-specific fields"],
      ["Product search", "Find products by name, generic, manufacturer, barcode, rack"],
      ["Product detail", "View stock summary, batch list, perform per-batch actions"],
      ["Category management", "Create hierarchical categories with color, icon, type"],
      ["Batch tracking", "Track each batch with auto-calculated status (active/near/expired)"],
      ["Stock adjustments", "Stock In/Out/Waste/Return with reasons and audit trail"],
      ["FEFO allocation", "Auto-pick earliest-expiry batch for sales and dispenses"],
      ["Quarantine", "Remove damaged/suspect batches from rotation"],
      ["Dispose", "End-of-life disposal with witness + method for compliance"],
      ["Return to supplier", "Record supplier returns with reason + quantity"],
      ["Bulk actions", "Apply actions to multiple batches at once"],
    ],
    [30, 70]
  ));

  return out;
}

function buildSalesSection() {
  const out = [];
  out.push(h1("9. Sales & Dispensing"));

  out.push(bodyPara(
    "The sales and dispensing module is what the pharmacy staff uses most frequently \u2014 often hundreds of times per day. InventoryOS optimizes this workflow for speed: the Quick Dispense screen allows completing a sale in three taps (search product, enter quantity, confirm), and the full sale flow supports multi-item invoices with discounts, tax, and multiple payment methods. Every sale uses the FEFO allocation engine by default, ensuring the earliest-expiry stock is sold first."
  ));

  out.push(h2("9.1 Quick Dispense (3-Tap POS)"));

  out.push(bodyPara(
    "The QuickDispense component is designed for the fast-paced pharmacy counter. The user searches for a product by name or barcode, enters the quantity, and confirms. The system shows a FEFO allocation preview (which batches will be deducted) before finalizing. Multiple items can be added to the cart before finalizing the sale. This is the fastest path for walk-in customers buying over-the-counter medicines."
  ));

  out.push(h2("9.2 Full Sale (Invoice) Creation"));

  out.push(bodyPara(
    "The full sale flow generates a sequential invoice number (INV-YYYY-NNNN, e.g., INV-2026-0007), applies FEFO per line item, calculates subtotal, discount, tax, and total, records the payment method and payment status, and links to a customer (optional \u2014 walk-in sales are supported with a null customerId). The Sale model tracks: invoiceNo, customerId, items (SaleItem[] with productId, batchId, quantity, unitPrice, discount, tax), subtotal, discountAmount, taxAmount, total, paymentMethod, paymentStatus (unpaid, partial, paid), status (active, cancelled), and audit fields (createdAt, createdBy, cancelledAt, cancelledBy, cancelReason)."
  ));

  out.push(h2("9.3 Sale Detail View"));

  out.push(bodyPara(
    "The SaleDetail component shows the complete sale: line items with batch info, customer info, payment history, and refund/return actions. A print button generates a printable invoice via window.print(). This is the screen a pharmacist uses when a customer returns with a question about a past purchase, or when staff needs to process a return or refund."
  ));

  out.push(h2("9.4 Returns & Refunds"));

  out.push(bodyPara(
    "Returns are tracked separately from sales with their own sequential number (RET-YYYY-NNNN). The ReturnsManager UI allows processing partial returns per line item (e.g., customer bought 10 tablets, returns 3). A restock toggle controls whether the returned items go back into inventory (default yes, unless they are damaged). Five return reasons are supported: defective, wrong_item, expired, customer_changed_mind, other. Refund methods include cash, credit (added to customer's credit account), and store_credit (for future purchases). The reason field must be at the request body level (not inside the items array), which is a documented API requirement."
  ));

  out.push(h2("9.5 Discount Rules Engine"));

  out.push(bodyPara(
    "The discount rules engine allows pharmacies to configure automatic discounts that apply at sale time. Each rule has: a type (percent or flat amount), conditions (none, minimum quantity, minimum amount, customer tag, schedule type, time-based), scope (all products, specific category, specific product, specific schedule type), priority (for ordering when multiple rules apply), start/end dates (for time-limited promotions), and tracks usage (timesUsed and totalDiscountGiven) so the pharmacist can see which rules are performing well. For example, a pharmacy could create a rule: 10 percent off all OTC products for customers tagged 'senior', priority 1, valid January 1 to December 31."
  ));

  out.push(h2("9.6 FEFO Override with Audit"));

  out.push(bodyPara(
    "In some cases, staff needs to manually pick a non-FEFO batch \u2014 for example, when the FEFO batch is damaged, recalled, or being held for a specific customer. The system allows this via the manualBatches field in the dispense API, but requires a reason (minimum 10 characters). Every override creates a FefoOverride audit trail row capturing the userId, expected batch (what FEFO would have picked), selected batch (what was actually picked), and reason. This audit trail is exportable via the FEFO Override Report for DGDA compliance."
  ));

  out.push(h2("9.7 Sale Cancellation"));

  out.push(bodyPara(
    "Sales can be cancelled (distinct from returns \u2014 a cancellation voids the entire sale, while a return processes a partial refund). The Sale model has status (active, cancelled), cancelledAt, cancelledBy, and cancelReason fields. Cancelling a sale reverses the stock deduction (restocks the batches) and reverses the payment, but preserves the audit trail. Double-cancellation is blocked by the status check."
  ));

  out.push(h2("9.8 Payment Methods"));

  out.push(bodyPara(
    "Six payment methods are supported: cash, card, mobile_banking (bKash, Nagad, Rocket), credit (customer pays later), mixed (combination of methods), and cheque. Each sale can have one or more Payment records (for partial payments, mixed payments, or installment payments). The Payment model tracks: amount, method, reference (transaction ID, cheque number), createdAt, createdBy."
  ));

  return out;
}

function buildPurchasesSection() {
  const out = [];
  out.push(h1("10. Purchases, Suppliers & Customers"));

  out.push(h2("10.1 Supplier Master"));

  out.push(bodyPara(
    "The Supplier model tracks: name, code (auto-generated as SUP-001, SUP-002, etc.), contact person, phone, email, address, balance (outstanding payable to this supplier), totalPurchased (lifetime purchase value), totalPaid (lifetime payment value), and notes. The SupplierManager UI provides a searchable, filterable list with balance indicators, and the SupplierDetailView shows a complete picture: balance breakdown with aging buckets (current, 31-60 days, 61-90 days, 90+ days), outstanding purchases list, payment history, and a record-payment dialog."
  ));

  out.push(h2("10.2 Purchase Order Creation"));

  out.push(bodyPara(
    "Creating a purchase order generates a sequential PO number (PO-YYYY-NNNN), auto-creates a Batch for each line item (with batchNo, mfgDate, expiryDate, mrp, quantity, purchase price), auto-syncs the Inventory record (sum of all batches), links to the supplier, and updates the supplier's balance. The system blocks purchase orders with missing expiry dates \u2014 a pharmacy-specific requirement, since every medicine batch must have an expiry date for FEFO tracking. The PurchaseForm UI supports adding multiple line items, each with its own batch details."
  ));

  out.push(h2("10.3 Purchase Returns to Supplier"));

  out.push(bodyPara(
    "Purchase returns (POST /purchases/[purchaseId]/returns) handle the case where a supplier delivers damaged or incorrect stock. The system reduces stock (deletes or marks the linked batches as returned), refunds from the supplier (reduces Supplier.balance), and marks the affected batches as returned status. The PurchaseReturnDialog UI guides the user through selecting which items to return and the reason."
  ));

  out.push(h2("10.4 Customer Management"));

  out.push(bodyPara(
    "The Customer model tracks: name, phone, email, address, date of birth, gender, chronic conditions (comma-separated, e.g., 'diabetes, hypertension'), allergies, and notes. Loyalty metrics are auto-maintained: totalSpent (lifetime purchase value), visitCount (number of sales), lastVisitAt (timestamp of last sale). The CustomerCreditView shows outstanding balance across all the customer's sales, aging buckets (current, 31-60, 61-90, 90+), payment history per sale, and a payment recording dialog. Walk-in sales are supported via a nullable customerId on the Sale model."
  ));

  out.push(h2("10.5 Stats and Analytics"));

  out.push(bodyPara(
    "Two stats endpoints provide aggregated insights. The supplier stats endpoint (GET /suppliers/stats) returns top suppliers by purchase value (last 30 days), total balance across all suppliers, total purchased, and total paid. The purchase stats endpoint (GET /purchases/stats) returns today/week/month totals plus a 7-day trend chart data. These feed the supplier management UI and the unified business dashboard."
  ));

  return out;
}

module.exports = {
  buildPart2Divider,
  buildProductInventorySection,
  buildSalesSection,
  buildPurchasesSection,
};
