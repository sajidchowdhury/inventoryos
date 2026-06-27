// Test Phase 2c APIs: Quarantine, Dispose, Auto-sync, Transactions
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
  console.log('=== Phase 2c API Tests ===\n');

  // Pick Napa Extra
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?search=Napa&limit=1`);
  const product = productsRes.data?.products?.[0];
  console.log(`Using product: ${product?.name} (${product?.id})\n`);

  // Setup: Create 3 test batches
  console.log('--- Setting up test batches ---');
  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 2);
  const nearDate = new Date(); nearDate.setDate(nearDate.getDate() + 45);
  const pastDate = new Date(); pastDate.setMonth(pastDate.getMonth() - 3);

  const batchA = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id, batchNo: '2C-A',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 100, purchasePrice: 5, mrp: 50,
  });
  const batchB = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id, batchNo: '2C-B',
    expiryDate: nearDate.toISOString().split('T')[0],
    quantity: 50, purchasePrice: 5, mrp: 50,
  });
  const batchC = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id, batchNo: '2C-C',
    expiryDate: pastDate.toISOString().split('T')[0],
    quantity: 20, purchasePrice: 5, mrp: 50,
  });
  console.log(`Created batches: A=${batchA.data?.batch?.id?.slice(-6)}, B=${batchB.data?.batch?.id?.slice(-6)}, C=${batchC.data?.batch?.id?.slice(-6)}`);
  console.log(`  Batch A: 100 units, 2yr expiry (active)`);
  console.log(`  Batch B: 50 units, 45d expiry (near_expiry)`);
  console.log(`  Batch C: 20 units, expired (expired)`);
  console.log(`  Total stock: ${100+50+20} = 170\n`);

  // 1. Quarantine batch B (suspected quality issue)
  console.log('1. POST /batches/[id]/quarantine (suspected quality issue)');
  const qRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batchB.data?.batch?.id}/quarantine`, {
    reason: 'suspected',
    notes: 'Customer reported unusual smell',
  });
  console.log(`   Status: ${qRes.status}`);
  console.log(`   Batch status: ${qRes.data?.batch?.status} (expected: quarantined)`);
  console.log(`   Message: ${qRes.data?.message}\n`);

  // 2. Verify quarantined batch is excluded from FEFO
  console.log('2. POST /products/[id]/allocate (verify quarantined batch is excluded)');
  const allocRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/${product.id}/allocate`, {
    quantity: 110, execute: false,
  });
  console.log(`   Status: ${allocRes.status}`);
  console.log(`   Allocated: ${allocRes.data?.allocatedQuantity} (expected 110)`);
  console.log(`   Available: ${allocRes.data?.availableQuantity} (expected 120 = 100 active + 20 expired)`);
  console.log(`   Wait — expired is also excluded. So only 100 from Batch A is available.`);
  console.log(`   Re-checking: should fail with shortfall since 110 > 100`);
  console.log(`   Shortfall: ${allocRes.data?.shortFall} (expected 10)\n`);

  // 3. Verify quarantined batch is excluded from FEFO with smaller qty
  console.log('3. POST /products/[id]/allocate (qty=50, should only take from A)');
  const allocRes2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/${product.id}/allocate`, {
    quantity: 50, execute: false,
  });
  console.log(`   Status: ${allocRes2.status}`);
  console.log(`   Allocations:`);
  allocRes2.data?.allocations?.forEach((a) => {
    console.log(`     ${a.batchNo}: allocated ${a.allocated} (was ${a.availableBefore})`);
  });
  console.log(`   Expected: Only Batch A (50 taken), B excluded (quarantined), C excluded (expired)\n`);

  // 4. Try to quarantine already-quarantined batch (should fail)
  console.log('4. POST /batches/[id]/quarantine (already quarantined → 400)');
  const qRes2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batchB.data?.batch?.id}/quarantine`, {
    reason: 'damaged',
  });
  console.log(`   Status: ${qRes2.status} (expected 400)`);
  console.log(`   Error: ${qRes2.data?.error}\n`);

  // 5. Release batch from quarantine
  console.log('5. DELETE /batches/[id]/quarantine (release batch B)');
  const releaseRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${batchB.data?.batch?.id}/quarantine`);
  console.log(`   Status: ${releaseRes.status}`);
  console.log(`   New status: ${releaseRes.data?.batch?.status} (expected: near_expiry since 45d left)`);
  console.log(`   Message: ${releaseRes.data?.message}\n`);

  // 6. Auto-sync endpoint (GET to check status)
  console.log('6. GET /batches/auto-sync (check sync status)');
  const syncCheck = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/batches/auto-sync`);
  console.log(`   Status: ${syncCheck.status}`);
  console.log(`   Total batches: ${syncCheck.data?.totalBatches}`);
  console.log(`   Batches needing update: ${syncCheck.data?.batchesNeedingUpdate}`);
  console.log(`   Current status counts:`, JSON.stringify(syncCheck.data?.currentStatusCounts, null, 2));
  console.log('');

  // 7. Auto-sync endpoint (POST to perform sync)
  console.log('7. POST /batches/auto-sync (perform sync)');
  const syncRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/auto-sync`);
  console.log(`   Status: ${syncRes.status}`);
  console.log(`   Status changes: ${syncRes.data?.summary?.statusChanges}`);
  console.log(`   By status:`, JSON.stringify(syncRes.data?.summary?.byStatus, null, 2));
  console.log('');

  // 8. Dispose part of batch C (expired stock)
  console.log('8. POST /batches/[id]/dispose (dispose 10 of 20 expired units from C)');
  const disposeRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batchC.data?.batch?.id}/dispose`, {
    quantity: 10,
    reason: 'expired',
    disposalMethod: 'incineration',
    witness: 'Test Pharmacist',
    notes: 'Expired stock disposal — partial',
  });
  console.log(`   Status: ${disposeRes.status}`);
  console.log(`   Batch remaining: ${disposeRes.data?.batch?.quantity} (expected 10)`);
  console.log(`   Batch status: ${disposeRes.data?.batch?.status} (expected: expired — partial disposal)`);
  console.log(`   Value lost: ৳${disposeRes.data?.disposal?.valueLost} (expected 500 = 10×50)`);
  console.log(`   Is full disposal: ${disposeRes.data?.disposal?.isFullDisposal} (expected false)`);
  console.log(`   Message: ${disposeRes.data?.message}\n`);

  // 9. Dispose remaining stock from batch C (full disposal)
  console.log('9. POST /batches/[id]/dispose (dispose remaining 10 from C — full)');
  const disposeRes2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batchC.data?.batch?.id}/dispose`, {
    quantity: 10,
    reason: 'expired',
    disposalMethod: 'incineration',
    witness: 'Test Pharmacist',
  });
  console.log(`   Status: ${disposeRes2.status}`);
  console.log(`   Batch remaining: ${disposeRes2.data?.batch?.quantity} (expected 0)`);
  console.log(`   Batch status: ${disposeRes2.data?.batch?.status} (expected: destroyed)`);
  console.log(`   Is full disposal: ${disposeRes2.data?.disposal?.isFullDisposal} (expected true)\n`);

  // 10. Try to dispose more than available (should fail)
  console.log('10. POST /batches/[id]/dispose (try to dispose 999 from destroyed batch → 400)');
  const disposeFail = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batchC.data?.batch?.id}/dispose`, {
    quantity: 999,
    reason: 'expired',
  });
  console.log(`   Status: ${disposeFail.status} (expected 400)`);
  console.log(`   Error: ${disposeFail.data?.error}\n`);

  // 11. Get transactions log (verify audit trail)
  console.log('11. GET /transactions (verify audit trail)');
  const txRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/transactions?limit=20`);
  console.log(`   Status: ${txRes.status}`);
  console.log(`   Total transactions: ${txRes.data?.pagination?.total}`);
  console.log(`   Summary by type:`, JSON.stringify(txRes.data?.summary, null, 2));
  console.log(`   Recent transactions (first 5):`);
  txRes.data?.transactions?.slice(0, 5).forEach((t) => {
    console.log(`     [${t.type}] ${t.product.name} — ${t.quantity} ${t.product.unit} — ${t.note?.substring(0, 80)}...`);
  });
  console.log('');

  // 12. Filter transactions by type=WASTE
  console.log('12. GET /transactions?type=WASTE (filter disposals)');
  const wasteRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/transactions?type=WASTE`);
  console.log(`   Status: ${wasteRes.status}`);
  console.log(`   Waste transactions: ${wasteRes.data?.pagination?.total}`);
  wasteRes.data?.transactions?.forEach((t) => {
    console.log(`     ${t.product.name}: ${t.quantity} ${t.product.unit} — ৳${(t.unitPrice||0) * t.quantity}`);
  });
  console.log('');

  // 13. Filter transactions by productId
  console.log('13. GET /transactions?productId=X (filter by product)');
  const prodTxRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/transactions?productId=${product.id}&limit=10`);
  console.log(`   Status: ${prodTxRes.status}`);
  console.log(`   Transactions for ${product.name}: ${prodTxRes.data?.pagination?.total}`);
  console.log('');

  // ===== CLEANUP =====
  console.log('--- Cleanup: Delete test batches ---');
  for (const bid of [batchA.data?.batch?.id, batchB.data?.batch?.id]) {
    if (bid) {
      const del = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${bid}`);
      console.log(`   Deleted ${bid?.slice(-6)}: ${del.status}`);
    }
  }
  // Batch C is destroyed with 0 quantity — also delete
  if (batchC.data?.batch?.id) {
    const del = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${batchC.data?.batch?.id}`);
    console.log(`   Deleted batch C (destroyed): ${del.status}`);
  }

  // Final verification
  const finalCheck = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`\n   Final inventory: ${finalCheck.data?.product?.inventory?.quantity} (expected 0)`);

  console.log('\n=== All Phase 2c tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
