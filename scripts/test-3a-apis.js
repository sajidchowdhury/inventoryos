// Test Phase 3a APIs: Expiry Stats, Bulk Actions, Supplier Return
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
  console.log('=== Phase 3a API Tests ===\n');

  // Setup: Create test batches with various expiry dates
  console.log('--- Setting up test batches ---');
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=3`);
  const products = productsRes.data?.products || [];
  const product = products[0];
  const product2 = products[1];
  const product3 = products[2];
  console.log(`Using products: ${product?.name}, ${product2?.name}, ${product3?.name}\n`);

  const now = new Date();
  const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago (expired)
  const fiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days (critical_7d)
  const twentyDays = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // 20 days (critical_30d)
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days (warning_90d)
  const twoYears = new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000); // 2 years (safe)

  const batches = [];
  const batchSetup = [
    { product: product, batchNo: '3A-EXP', expiry: pastDate, qty: 20, label: 'expired' },
    { product: product, batchNo: '3A-7D', expiry: fiveDays, qty: 15, label: 'critical_7d' },
    { product: product2, batchNo: '3A-30D', expiry: twentyDays, qty: 30, label: 'critical_30d' },
    { product: product2, batchNo: '3A-90D', expiry: sixtyDays, qty: 40, label: 'warning_90d' },
    { product: product3, batchNo: '3A-SAFE', expiry: twoYears, qty: 100, label: 'safe' },
  ];

  for (const setup of batchSetup) {
    const res = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
      productId: setup.product.id,
      batchNo: setup.batchNo,
      expiryDate: setup.expiry.toISOString().split('T')[0],
      quantity: setup.qty,
      purchasePrice: 5,
      mrp: 50,
    });
    batches.push({ ...res.data?.batch, label: setup.label });
    console.log(`  Created ${setup.batchNo} (${setup.label}): ${setup.qty} units, expires ${setup.expiry.toISOString().split('T')[0]}`);
  }
  console.log('');

  // 1. Test Expiry Stats API
  console.log('1. GET /expiry-stats (full aggregation)');
  const statsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/expiry-stats?days=90`);
  console.log(`   Status: ${statsRes.status}`);
  console.log(`   Summary:`);
  console.log(`     Total batches: ${statsRes.data?.summary?.totalBatches}`);
  console.log(`     Total units: ${statsRes.data?.summary?.totalUnits}`);
  console.log(`     Units at risk: ${statsRes.data?.summary?.totalUnitsAtRisk}`);
  console.log(`     Value at risk: ৳${statsRes.data?.summary?.totalValueAtRisk?.toFixed(2)}`);
  console.log(`   Buckets:`);
  const buckets = statsRes.data?.buckets;
  if (buckets) {
    console.log(`     expired:        ${buckets.expired.count} batches, ${buckets.expired.quantity} units, ৳${buckets.expired.value.toFixed(2)}`);
    console.log(`     critical_7d:    ${buckets.critical_7d.count} batches, ${buckets.critical_7d.quantity} units, ৳${buckets.critical_7d.value.toFixed(2)}`);
    console.log(`     critical_30d:   ${buckets.critical_30d.count} batches, ${buckets.critical_30d.quantity} units, ৳${buckets.critical_30d.value.toFixed(2)}`);
    console.log(`     warning_90d:    ${buckets.warning_90d.count} batches, ${buckets.warning_90d.quantity} units, ৳${buckets.warning_90d.value.toFixed(2)}`);
    console.log(`     safe:           ${buckets.safe.count} batches, ${buckets.safe.quantity} units, ৳${buckets.safe.value.toFixed(2)}`);
    console.log(`     quarantined:    ${buckets.quarantined.count} batches, ${buckets.quarantined.quantity} units`);
  }
  console.log(`   Timeline (13 weeks):`);
  statsRes.data?.timeline?.forEach((w) => {
    if (w.count > 0) console.log(`     ${w.weekLabel} (${w.weekStart} to ${w.weekEnd}): ${w.count} batches, ${w.quantity} units, ৳${w.value.toFixed(2)}`);
  });
  console.log(`   Top manufacturers:`);
  statsRes.data?.manufacturerBreakdown?.slice(0, 3).forEach((m) => {
    console.log(`     ${m.name}: ${m.count} batches, ${m.quantity} units, ৳${m.value.toFixed(2)}`);
  });
  console.log('');

  // 2. Test Bulk Quarantine (multiple batches)
  console.log('2. POST /batches/bulk (quarantine 2 batches)');
  const batchIdsToQuarantine = [batches[0].id, batches[1].id]; // expired + critical_7d
  const bulkQRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/bulk`, {
    batchIds: batchIdsToQuarantine,
    action: 'quarantine',
    reason: 'suspected',
    notes: 'Bulk quarantine test — suspected quality issue',
  });
  console.log(`   Status: ${bulkQRes.status}`);
  console.log(`   Success: ${bulkQRes.data?.summary?.success}/${bulkQRes.data?.summary?.total}`);
  bulkQRes.data?.results?.forEach((r) => {
    console.log(`     ${r.success ? '✓' : '✗'} ${r.productName || r.error}`);
  });
  console.log('');

  // 3. Verify quarantined batches now in quarantined bucket
  console.log('3. Verify buckets after bulk quarantine');
  const statsRes2 = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/expiry-stats?days=90`);
  console.log(`   expired: ${statsRes2.data?.buckets?.expired.count} (expected 0 — moved to quarantined)`);
  console.log(`   critical_7d: ${statsRes2.data?.buckets?.critical_7d.count} (expected 0 — moved to quarantined)`);
  console.log(`   quarantined: ${statsRes2.data?.buckets?.quarantined.count} (expected 2)`);
  console.log('');

  // 4. Test Bulk Release
  console.log('4. POST /batches/bulk (release 2 quarantined batches)');
  const bulkRelRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/bulk`, {
    batchIds: batchIdsToQuarantine,
    action: 'release',
  });
  console.log(`   Status: ${bulkRelRes.status}`);
  console.log(`   Success: ${bulkRelRes.data?.summary?.success}/${bulkRelRes.data?.summary?.total}`);
  bulkRelRes.data?.results?.forEach((r) => {
    console.log(`     ${r.success ? '✓' : '✗'} ${r.batchNo} → ${r.newStatus || r.error}`);
  });
  console.log('');

  // 5. Test Supplier Return (single batch)
  console.log('5. POST /batches/[id]/return (return expired batch to supplier)');
  const returnRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batches[0].id}/return`, {
    supplierName: 'Square Pharmaceuticals Ltd',
    reason: 'expired',
    creditExpected: true,
    notes: 'Returned per supplier agreement',
  });
  console.log(`   Status: ${returnRes.status}`);
  console.log(`   Batch status: ${returnRes.data?.batch?.status} (expected: returned)`);
  console.log(`   Batch quantity: ${returnRes.data?.batch?.quantity} (expected: 0)`);
  console.log(`   Value returned: ৳${returnRes.data?.return?.valueReturned?.toFixed(2)}`);
  console.log(`   Supplier stored: ${returnRes.data?.batch?.supplierId}`);
  console.log('');

  // 6. Test Bulk Dispose (multiple batches)
  console.log('6. POST /batches/bulk (dispose 2 batches — critical_7d + critical_30d)');
  const batchIdsToDispose = [batches[1].id, batches[2].id];
  const bulkDispRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/bulk`, {
    batchIds: batchIdsToDispose,
    action: 'dispose',
    reason: 'expired',
    disposalMethod: 'incineration',
    witness: 'Test Pharmacist',
    notes: 'Bulk disposal of near-expiry stock',
  });
  console.log(`   Status: ${bulkDispRes.status}`);
  console.log(`   Success: ${bulkDispRes.data?.summary?.success}/${bulkDispRes.data?.summary?.total}`);
  let totalValueLost = 0;
  bulkDispRes.data?.results?.forEach((r) => {
    if (r.success) {
      totalValueLost += r.valueLost || 0;
      console.log(`     ✓ ${r.productName} (Batch ${r.batchNo}): ৳${r.valueLost?.toFixed(2)} lost`);
    } else {
      console.log(`     ✗ ${r.error}`);
    }
  });
  console.log(`   Total value lost: ৳${totalValueLost.toFixed(2)}`);
  console.log('');

  // 7. Verify final state
  console.log('7. Final state verification');
  const statsRes3 = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/expiry-stats?days=90`);
  console.log(`   Total batches now: ${statsRes3.data?.summary?.totalBatches}`);
  console.log(`   Buckets:`);
  console.log(`     safe: ${statsRes3.data?.buckets?.safe.count} (expected 1)`);
  console.log(`     warning_90d: ${statsRes3.data?.buckets?.warning_90d.count} (expected 1)`);
  console.log(`     expired: ${statsRes3.data?.buckets?.expired.count} (expected 0 — returned)`);
  console.log(`     critical_7d: ${statsRes3.data?.buckets?.critical_7d.count} (expected 0 — disposed)`);
  console.log(`     critical_30d: ${statsRes3.data?.buckets?.critical_30d.count} (expected 0 — disposed)`);
  console.log('');

  // 8. Test invalid bulk action
  console.log('8. POST /batches/bulk (invalid action → 400)');
  const invalidRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/bulk`, {
    batchIds: [batches[3].id],
    action: 'invalid_action',
  });
  console.log(`   Status: ${invalidRes.status} (expected 400)`);
  console.log(`   Error: ${invalidRes.data?.error}`);
  console.log('');

  // 9. Test bulk with empty batchIds
  console.log('9. POST /batches/bulk (empty batchIds → 400)');
  const emptyRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/bulk`, {
    batchIds: [],
    action: 'quarantine',
  });
  console.log(`   Status: ${emptyRes.status} (expected 400)`);
  console.log(`   Error: ${emptyRes.data?.error}`);
  console.log('');

  // ===== CLEANUP =====
  console.log('--- Cleanup ---');
  for (const batch of batches) {
    const del = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${batch.id}`);
    console.log(`   Deleted ${batch.batchNo}: ${del.status}`);
  }

  console.log('\n=== All Phase 3a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
