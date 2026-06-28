// Test Phase 5a APIs: Suppliers, Purchases with auto-batch creation, Cancel
import http from 'http';

const BUSINESS_ID = 'cmqw75ln30003vo9ahyhrs0lj';
const HOST = 'localhost';
const PORT = 3000;

function makeRequest(method, path, body = null, isJson = true) {
  return new Promise((resolve, reject) => {
    const headers = {};
    let data = '';
    if (body) {
      data = isJson ? JSON.stringify(body) : body;
      headers['Content-Type'] = isJson ? 'application/json' : 'text/csv';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({ hostname: HOST, port: PORT, path, method, headers }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: isJson ? JSON.parse(b) : b, raw: b });
        } catch (e) {
          resolve({ status: res.statusCode, data: b, raw: b });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Phase 5a API Tests ===\n');

  // ── SUPPLIERS ──
  console.log('--- Suppliers ---');

  // 1. Create supplier
  console.log('1. POST /suppliers (create supplier)');
  const supRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/suppliers`, {
    name: 'Square Pharmaceuticals Ltd',
    contactPerson: 'Mr. Rahman',
    phone: '01711112222',
    email: 'orders@squarepharma.com',
    address: 'Block C, Mirpur, Dhaka',
  });
  console.log(`   Status: ${supRes.status}`);
  console.log(`   Supplier: ${supRes.data?.supplier?.name}`);
  console.log(`   Auto-generated code: ${supRes.data?.supplier?.code}`);
  const supplierId = supRes.data?.supplier?.id;

  // 2. Duplicate code check
  console.log('\n2. POST /suppliers (duplicate code → 409)');
  const dupRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/suppliers`, {
    name: 'Another Supplier',
    code: supRes.data?.supplier?.code,
  });
  console.log(`   Status: ${dupRes.status} (expected 409)`);
  console.log(`   Error: ${dupRes.data?.error}`);

  // 3. List suppliers
  console.log('\n3. GET /suppliers (list)');
  const listRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers`);
  console.log(`   Status: ${listRes.status}`);
  console.log(`   Total: ${listRes.data?.pagination?.total}`);

  // 4. Get supplier detail
  console.log('\n4. GET /suppliers/[id] (detail with purchases)');
  const getSupRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}`);
  console.log(`   Status: ${getSupRes.status}`);
  console.log(`   Name: ${getSupRes.data?.supplier?.name}`);
  console.log(`   Balance: ৳${getSupRes.data?.supplier?.balance}`);
  console.log(`   Total purchased: ৳${getSupRes.data?.supplier?.totalPurchased}`);

  // 5. Update supplier
  console.log('\n5. PUT /suppliers/[id] (update)');
  const updRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}`, {
    name: 'Square Pharma (Updated)',
    phone: '01733334444',
  });
  console.log(`   Status: ${updRes.status}`);
  console.log(`   Updated name: ${updRes.data?.supplier?.name}`);
  console.log(`   Updated phone: ${updRes.data?.supplier?.phone}`);

  // ── PURCHASES ──
  console.log('\n--- Purchases ---');

  // Get products for purchase
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=2`);
  const product1 = productsRes.data?.products?.[0];
  const product2 = productsRes.data?.products?.[1];
  console.log(`\nUsing products: ${product1?.name}, ${product2?.name}`);

  // Get initial inventory
  const prod1Before = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  const inv1Before = prod1Before.data?.product?.inventory?.quantity || 0;
  console.log(`Initial inventory: ${product1.name} = ${inv1Before}`);

  // 6. Create purchase with auto-batch creation
  console.log('\n6. POST /purchases (create with 2 items, auto-batch creation)');
  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 2);
  const purchaseRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/purchases`, {
    supplierId,
    invoiceNo: 'SUP-INV-2026-001',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [
      {
        productId: product1.id,
        productName: product1.name,
        quantity: 100,
        unitCost: 5,
        unit: product1.unit,
        batchNo: '5A-BATCH-1',
        expiryDate: futureDate.toISOString().split('T')[0],
        mrp: 50,
      },
      {
        productId: product2.id,
        productName: product2.name,
        quantity: 50,
        unitCost: 3,
        unit: product2.unit,
        batchNo: '5A-BATCH-2',
        expiryDate: futureDate.toISOString().split('T')[0],
        mrp: 30,
      },
    ],
    discountAmount: 10,
    taxAmount: 5,
    paidAmount: 600, // partial payment
    notes: 'Test purchase for Phase 5a',
  });
  console.log(`   Status: ${purchaseRes.status}`);
  console.log(`   Purchase No: ${purchaseRes.data?.purchase?.purchaseNo}`);
  console.log(`   Subtotal: ৳${purchaseRes.data?.purchase?.subtotal?.toFixed(2)} (expected 650 = 100×5 + 50×3)`);
  console.log(`   Discount: ৳${purchaseRes.data?.purchase?.discountAmount}`);
  console.log(`   Tax: ৳${purchaseRes.data?.purchase?.taxAmount}`);
  console.log(`   Total: ৳${purchaseRes.data?.purchase?.totalAmount?.toFixed(2)} (expected 645 = 650-10+5)`);
  console.log(`   Paid: ৳${purchaseRes.data?.purchase?.paidAmount}`);
  console.log(`   Payment status: ${purchaseRes.data?.purchase?.paymentStatus} (expected partial)`);
  console.log(`   Items created: ${purchaseRes.data?.purchase?.items?.length}`);
  console.log(`   Batches created:`);
  purchaseRes.data?.purchase?.items?.forEach((item) => {
    console.log(`     ${item.productName} → Batch ID: ${item.batch?.id?.slice(-6)}, No: ${item.batch?.batchNo}, Qty: ${item.batch?.quantity}, Status: ${item.batch?.status}`);
  });
  const purchaseId = purchaseRes.data?.purchase?.id;

  // 7. Verify inventory updated
  console.log('\n7. Verify inventory updated');
  const prod1After = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  const inv1After = prod1After.data?.product?.inventory?.quantity;
  console.log(`   ${product1.name} inventory: ${inv1Before} → ${inv1After} (expected +100)`);
  console.log(`   Batches for ${product1.name}: ${prod1After.data?.product?.batches?.length}`);
  const newBatch = prod1After.data?.product?.batches?.find((b) => b.batchNo === '5A-BATCH-1');
  if (newBatch) {
    console.log(`   New batch: ${newBatch.batchNo} — ${newBatch.quantity} ${product1.unit} — status: ${newBatch.status} — supplier: ${newBatch.supplierId ? 'linked' : 'null'}`);
  }

  // 8. Verify supplier balance updated
  console.log('\n8. Verify supplier balance updated');
  const supAfter = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}`);
  console.log(`   Supplier balance: ৳${supAfter.data?.supplier?.balance?.toFixed(2)} (expected 45 = 645-600 unpaid)`);
  console.log(`   Total purchased: ৳${supAfter.data?.supplier?.totalPurchased?.toFixed(2)} (expected 645)`);
  console.log(`   Total paid: ৳${supAfter.data?.supplier?.totalPaid?.toFixed(2)} (expected 600)`);
  console.log(`   Purchases count: ${supAfter.data?.supplier?._count?.purchases}`);

  // 9. Get purchase detail
  console.log('\n9. GET /purchases/[id] (detail)');
  const getPurchaseRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}`);
  console.log(`   Status: ${getPurchaseRes.status}`);
  console.log(`   Purchase No: ${getPurchaseRes.data?.purchase?.purchaseNo}`);
  console.log(`   Supplier: ${getPurchaseRes.data?.purchase?.supplier?.name}`);
  console.log(`   Items: ${getPurchaseRes.data?.purchase?.items?.length}`);

  // 10. List purchases
  console.log('\n10. GET /purchases (list with summary)');
  const listPurchasesRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/purchases?limit=5`);
  console.log(`   Status: ${listPurchasesRes.status}`);
  console.log(`   Total purchases: ${listPurchasesRes.data?.pagination?.total}`);
  console.log(`   Today: ${listPurchasesRes.data?.summary?.today?.count} purchase(s), ৳${listPurchasesRes.data?.summary?.today?.total?.toFixed(2)}`);
  console.log(`   Month: ${listPurchasesRes.data?.summary?.month?.count} purchase(s), ৳${listPurchasesRes.data?.summary?.month?.total?.toFixed(2)}`);
  console.log(`   Outstanding: ${listPurchasesRes.data?.summary?.outstanding?.count} unpaid, ৳${listPurchasesRes.data?.summary?.outstanding?.dueAmount?.toFixed(2)} due`);

  // 11. Purchase stats
  console.log('\n11. GET /purchases/stats');
  const statsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/purchases/stats`);
  console.log(`   Status: ${statsRes.status}`);
  console.log(`   Today: ৳${statsRes.data?.periods?.today?.total?.toFixed(2)} (${statsRes.data?.periods?.today?.count} purchases)`);
  console.log(`   Week: ৳${statsRes.data?.periods?.week?.total?.toFixed(2)}`);
  console.log(`   Month: ৳${statsRes.data?.periods?.month?.total?.toFixed(2)}`);
  console.log(`   Top suppliers:`);
  statsRes.data?.topSuppliers?.forEach((s) => {
    console.log(`     ${s.supplier?.name}: ৳${s.totalPurchased.toFixed(2)} (${s.purchaseCount} purchases)`);
  });
  console.log(`   Top products:`);
  statsRes.data?.topProducts?.forEach((p) => {
    console.log(`     ${p.productName}: ${p.quantity} units, ৳${p.totalCost.toFixed(2)}`);
  });
  console.log(`   Outstanding: ${statsRes.data?.outstanding?.count} purchases, ৳${statsRes.data?.outstanding?.dueAmount?.toFixed(2)} due`);

  // 12. Test missing expiry date (should fail for pharmacy)
  console.log('\n12. POST /purchases (missing expiry → 400)');
  const noExpiryRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/purchases`, {
    items: [{ productId: product1.id, quantity: 10, unitCost: 5 }],
  });
  console.log(`   Status: ${noExpiryRes.status} (expected 400)`);
  console.log(`   Error: ${noExpiryRes.data?.error}`);

  // 13. Cancel purchase (should reverse stock + delete batches)
  console.log('\n13. PUT /purchases/[id] (cancel — should reverse stock + delete batches)');
  const cancelRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}`, {
    action: 'cancel',
    cancelReason: 'Test cancellation — wrong items',
  });
  console.log(`   Status: ${cancelRes.status}`);
  console.log(`   Message: ${cancelRes.data?.message}`);

  // 14. Verify stock reversed
  console.log('\n14. Verify stock reversed after cancellation');
  const prod1Final = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  const inv1Final = prod1Final.data?.product?.inventory?.quantity;
  console.log(`   ${product1.name} inventory: ${inv1After} → ${inv1Final} (expected back to ${inv1Before})`);
  console.log(`   Batch 5A-BATCH-1 exists: ${prod1Final.data?.product?.batches?.some((b) => b.batchNo === '5A-BATCH-1') ? 'YES (unexpected)' : 'NO (deleted ✓)'}`);

  // 15. Verify supplier balance reversed
  console.log('\n15. Verify supplier balance reversed');
  const supFinal = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}`);
  console.log(`   Supplier balance: ৳${supFinal.data?.supplier?.balance?.toFixed(2)} (expected 0)`);
  console.log(`   Total purchased: ৳${supFinal.data?.supplier?.totalPurchased?.toFixed(2)} (expected 0 — reversed)`);

  // 16. Try to cancel already-cancelled (should fail)
  console.log('\n16. PUT /purchases/[id] (cancel already-cancelled → 400)');
  const reCancel = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}`, {
    action: 'cancel',
    cancelReason: 'Try again',
  });
  console.log(`   Status: ${reCancel.status} (expected 400)`);

  // ── CLEANUP ──
  console.log('\n--- Cleanup ---');
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}`);
  console.log('   Deleted test supplier');

  console.log('\n=== All Phase 5a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
