// Test Phase 2b APIs: FEFO allocation, batch sync, expiry alerts, quick dispense
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
  console.log('=== Phase 2b API Tests ===\n');

  // Pick a product (Napa Extra)
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?search=Napa&limit=1`);
  const product = productsRes.data?.products?.[0];
  console.log(`Using product: ${product?.name} (${product?.id})\n`);

  // ===== SCENARIO SETUP: Create 3 batches with different expiry dates =====
  console.log('--- Setting up FEFO test scenario ---');
  const futureDate1 = new Date(); futureDate1.setFullYear(futureDate1.getFullYear() + 2); // 2 years out (active)
  const futureDate2 = new Date(); futureDate2.setMonth(futureDate2.getMonth() + 6); // 6 months out (active)
  const nearDate = new Date(); nearDate.setDate(nearDate.getDate() + 45); // 45 days out (near_expiry)

  console.log(`Creating 3 batches:`);
  console.log(`  Batch A: 100 units, expires ${futureDate1.toISOString().split('T')[0]} (2yr, active)`);
  console.log(`  Batch B: 50 units, expires ${futureDate2.toISOString().split('T')[0]} (6mo, active)`);
  console.log(`  Batch C: 30 units, expires ${nearDate.toISOString().split('T')[0]} (45d, near_expiry)`);

  const batchA = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id, batchNo: 'FEFO-A', expiryDate: futureDate1.toISOString().split('T')[0],
    quantity: 100, purchasePrice: 5, mrp: 50,
  });
  const batchB = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id, batchNo: 'FEFO-B', expiryDate: futureDate2.toISOString().split('T')[0],
    quantity: 50, purchasePrice: 5, mrp: 50,
  });
  const batchC = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id, batchNo: 'FEFO-C', expiryDate: nearDate.toISOString().split('T')[0],
    quantity: 30, purchasePrice: 5, mrp: 50,
  });

  console.log(`  Created: A=${batchA.data?.batch?.id?.slice(-6)}, B=${batchB.data?.batch?.id?.slice(-6)}, C=${batchC.data?.batch?.id?.slice(-6)}`);
  console.log(`  Total stock: ${100 + 50 + 30} = 180 units\n`);

  // ===== TEST 1: FEFO dry-run allocation (should pick C first, then B, then A) =====
  console.log('1. POST /allocate (dry-run, qty=40)');
  console.log('   EXPECTED: Take 30 from C (nearest expiry), then 10 from B');
  const alloc1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/${product.id}/allocate`, {
    quantity: 40, execute: false,
  });
  console.log(`   Status: ${alloc1.status}`);
  console.log(`   Success: ${alloc1.data?.success}`);
  console.log(`   Allocations:`);
  alloc1.data?.allocations?.forEach((a) => {
    if (a.allocated > 0) {
      console.log(`     Batch ${a.batchNo} (exp ${a.expiryDate.split('T')[0]}): take ${a.allocated} of ${a.availableBefore} → ${a.remainingAfter} remaining`);
    }
  });
  console.log(`   Total allocated: ${alloc1.data?.allocatedQuantity} (expected 40)`);
  console.log('');

  // ===== TEST 2: FEFO dry-run with insufficient stock =====
  console.log('2. POST /allocate (dry-run, qty=999 — exceeds 180 available)');
  const alloc2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/${product.id}/allocate`, {
    quantity: 999, execute: false,
  });
  console.log(`   Status: ${alloc2.status} (expected 409)`);
  console.log(`   Allocated: ${alloc2.data?.allocatedQuantity} (expected 180)`);
  console.log(`   Shortfall: ${alloc2.data?.shortFall} (expected 819)`);
  console.log('');

  // ===== TEST 3: FEFO execute (actually reduce stock) =====
  console.log('3. POST /allocate (execute=true, qty=70)');
  console.log('   EXPECTED: Take 30 from C (depletes it), then 40 from B (10 left)');
  const alloc3 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/${product.id}/allocate`, {
    quantity: 70, execute: true, type: 'SALE', note: 'Test dispense',
  });
  console.log(`   Status: ${alloc3.status}`);
  console.log(`   Executed: ${alloc3.data?.executed}`);
  console.log(`   Execution results:`);
  alloc3.data?.executionResults?.forEach((r) => {
    console.log(`     Batch ${r.batchNo}: new qty ${r.newQuantity}, status ${r.status}`);
  });
  console.log('');

  // ===== TEST 4: Verify stock after execution =====
  console.log('4. Verify inventory after execution (expected 180-70=110)');
  const prodRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`   Inventory: ${prodRes.data?.product?.inventory?.quantity} (expected 110)`);
  console.log(`   Batches:`);
  prodRes.data?.product?.batches?.forEach((b) => {
    console.log(`     ${b.batchNo}: ${b.quantity} units (status: ${b.status})`);
  });
  console.log('');

  // ===== TEST 5: Batch Status Sync =====
  console.log('5. POST /batches/sync-status (recalculate all batch statuses)');
  const syncRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/sync-status`, {});
  console.log(`   Status: ${syncRes.status}`);
  console.log(`   Summary:`, JSON.stringify(syncRes.data?.summary, null, 2));
  console.log(`   Changes: ${syncRes.data?.changes?.length}`);
  console.log('');

  // ===== TEST 6: Expiry Alerts =====
  console.log('6. GET /expiry-alerts (should include batch C with 45d expiry)');
  const alertsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/expiry-alerts`);
  console.log(`   Status: ${alertsRes.status}`);
  console.log(`   Summary:`, JSON.stringify(alertsRes.data?.summary, null, 2));
  console.log(`   Top alerts:`);
  const allAlerts = [
    ...(alertsRes.data?.groups?.expired || []),
    ...(alertsRes.data?.groups?.critical || []),
    ...(alertsRes.data?.groups?.warning || []),
  ];
  allAlerts.slice(0, 3).forEach((a) => {
    console.log(`     ${a.product.name} — Batch ${a.batchNo} — ${a.daysUntilExpiry}d left — ${a.quantity} ${a.product.unit} — ৳${a.valueAtRisk} — ${a.suggestedAction}`);
  });
  console.log('');

  // ===== TEST 7: Quick Dispense (multi-item) =====
  console.log('7. POST /dispense (multi-item: Napa 20 + another product)');
  // Get another product
  const products2Res = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?search=Amodis&limit=1`);
  const product2 = products2Res.data?.products?.[0];

  // Add a batch to product 2 for testing
  if (product2) {
    const batchD = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
      productId: product2.id, batchNo: 'FEFO-D',
      expiryDate: nearDate.toISOString().split('T')[0],
      quantity: 100, purchasePrice: 3, mrp: 30,
    });
    console.log(`   (Setup: Added batch D with 100 units to ${product2.name})`);
  }

  const dispenseRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/dispense`, {
    items: [
      { productId: product.id, quantity: 20 },
      { productId: product2?.id, quantity: 15 },
    ],
    note: 'Multi-item test dispense',
  });
  console.log(`   Status: ${dispenseRes.status}`);
  console.log(`   Success: ${dispenseRes.data?.success}`);
  console.log(`   Summary:`, JSON.stringify(dispenseRes.data?.summary, null, 2));
  console.log(`   Per-item results:`);
  dispenseRes.data?.results?.forEach((r) => {
    console.log(`     ${r.productName}: requested ${r.requested}, allocated ${r.allocated}, success ${r.success}`);
    r.allocations?.forEach((a) => {
      if (a.allocated > 0) console.log(`       ← Batch ${a.batchNo} (exp ${a.expiryDate.split('T')[0]}): -${a.allocated}`);
    });
  });
  console.log('');

  // ===== TEST 8: Verify final stock state =====
  console.log('8. Final stock state');
  const finalProd = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`   ${product.name}: ${finalProd.data?.product?.inventory?.quantity} units (was 110, dispensed 20 more → 90)`);
  finalProd.data?.product?.batches?.forEach((b) => {
    console.log(`     ${b.batchNo}: ${b.quantity} units`);
  });

  if (product2) {
    const finalProd2 = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product2.id}`);
    console.log(`   ${product2.name}: ${finalProd2.data?.product?.inventory?.quantity} units (was 100, dispensed 15 → 85)`);
  }
  console.log('');

  // ===== CLEANUP: Delete all FEFO test batches =====
  console.log('--- Cleanup: Delete all FEFO test batches ---');
  for (const bid of [batchA.data?.batch?.id, batchB.data?.batch?.id, batchC.data?.batch?.id]) {
    if (bid) {
      await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${bid}`);
    }
  }
  // Also fetch and delete batch D
  const prod2Batches = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product2?.id}`);
  for (const b of prod2Batches.data?.product?.batches || []) {
    if (b.batchNo === 'FEFO-D') {
      await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${b.id}`);
    }
  }

  // Verify cleanup
  const finalCheck = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`   ${product.name} final stock: ${finalCheck.data?.product?.inventory?.quantity} (expected 0)`);

  console.log('\n=== All Phase 2b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
