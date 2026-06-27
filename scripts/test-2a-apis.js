// Test Phase 2a APIs: Batches CRUD, Stock Adjust, Auto-status, Inventory sync
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
          const json = isJson ? JSON.parse(b) : b;
          resolve({ status: res.statusCode, data: json, raw: b });
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
  console.log('=== Phase 2a API Tests ===\n');

  // Get a product to attach batches to
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=5`);
  const product = productsRes.data?.products?.[0];
  console.log(`Using product: ${product?.name} (${product?.id})\n`);

  // 1. Create batch with future expiry (status should be "active")
  console.log('1. POST /batches (future expiry → active)');
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 2);
  const batch1Res = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id,
    batchNo: 'TEST-FUTURE-001',
    mfgDate: '2025-01-01',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 100,
    purchasePrice: 5,
    mrp: 50,
    notes: 'Test batch with future expiry',
  });
  console.log(`   Status: ${batch1Res.status}`);
  console.log(`   Batch: ${batch1Res.data?.batch?.batchNo} (status: ${batch1Res.data?.batch?.status})`);
  const batch1Id = batch1Res.data?.batch?.id;

  // 2. Create batch with near-expiry (status should be "near_expiry")
  console.log('\n2. POST /batches (near expiry → near_expiry)');
  const nearDate = new Date();
  nearDate.setDate(nearDate.getDate() + 60); // 60 days from now
  const batch2Res = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id,
    batchNo: 'TEST-NEAR-001',
    expiryDate: nearDate.toISOString().split('T')[0],
    quantity: 50,
    purchasePrice: 4,
    mrp: 50,
  });
  console.log(`   Status: ${batch2Res.status}`);
  console.log(`   Batch: ${batch2Res.data?.batch?.batchNo} (status: ${batch2Res.data?.batch?.status})`);
  const batch2Id = batch2Res.data?.batch?.id;

  // 3. Create batch with expired date (status should be "expired")
  console.log('\n3. POST /batches (past expiry → expired)');
  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 3); // 3 months ago
  const batch3Res = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id,
    batchNo: 'TEST-EXPIRED-001',
    expiryDate: pastDate.toISOString().split('T')[0],
    quantity: 20,
    purchasePrice: 3,
    mrp: 50,
  });
  console.log(`   Status: ${batch3Res.status}`);
  console.log(`   Batch: ${batch3Res.data?.batch?.batchNo} (status: ${batch3Res.data?.batch?.status})`);

  // 4. Test duplicate batch number (should fail)
  console.log('\n4. POST /batches (duplicate batch number → 400)');
  const dupRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product.id,
    batchNo: 'TEST-FUTURE-001',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 10,
  });
  console.log(`   Status: ${dupRes.status} (expected 400)`);
  console.log(`   Error: ${dupRes.data?.error}`);

  // 5. Verify inventory updated
  console.log('\n5. Verify inventory updated (should be 100+50+20 = 170)');
  const prodRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`   Inventory quantity: ${prodRes.data?.product?.inventory?.quantity}`);
  console.log(`   Number of batches: ${prodRes.data?.product?.batches?.length}`);

  // 6. List all batches with summary
  console.log('\n6. GET /batches (list all with summary)');
  const listRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/batches?limit=50`);
  console.log(`   Status: ${listRes.status}`);
  console.log(`   Total batches: ${listRes.data?.pagination?.total}`);
  console.log(`   Summary:`, JSON.stringify(listRes.data?.summary, null, 2));

  // 7. Filter by status
  console.log('\n7. GET /batches?status=expired (filter)');
  const expiredRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/batches?status=expired`);
  console.log(`   Expired batches: ${expiredRes.data?.pagination?.total}`);

  // 8. Filter by expiringDays
  console.log('\n8. GET /batches?expiringDays=90 (next 90 days)');
  const expiringRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/batches?expiringDays=90`);
  console.log(`   Batches expiring in 90 days: ${expiringRes.data?.pagination?.total}`);

  // 9. Stock IN adjustment
  console.log('\n9. POST /batches/[id]/adjust (STOCK_IN +30)');
  const stockInRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batch1Id}/adjust`, {
    type: 'STOCK_IN',
    quantity: 30,
    note: 'Restocked from supplier',
  });
  console.log(`   Status: ${stockInRes.status}`);
  console.log(`   New quantity: ${stockInRes.data?.batch?.quantity} (expected 130)`);

  // 10. Stock OUT adjustment
  console.log('\n10. POST /batches/[id]/adjust (STOCK_OUT -50)');
  const stockOutRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batch1Id}/adjust`, {
    type: 'STOCK_OUT',
    quantity: 50,
    note: 'Sold to customer',
  });
  console.log(`   Status: ${stockOutRes.status}`);
  console.log(`   New quantity: ${stockOutRes.data?.batch?.quantity} (expected 80)`);

  // 11. Stock OUT exceeding available (should fail)
  console.log('\n11. POST /batches/[id]/adjust (STOCK_OUT exceeding → 400)');
  const overOutRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batch1Id}/adjust`, {
    type: 'STOCK_OUT',
    quantity: 9999,
  });
  console.log(`   Status: ${overOutRes.status} (expected 400)`);
  console.log(`   Error: ${overOutRes.data?.error}`);

  // 12. WASTE adjustment
  console.log('\n12. POST /batches/[id]/adjust (WASTE -10)');
  const wasteRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches/${batch1Id}/adjust`, {
    type: 'WASTE',
    quantity: 10,
    note: 'Damaged strips',
  });
  console.log(`   Status: ${wasteRes.status}`);
  console.log(`   New quantity: ${wasteRes.data?.batch?.quantity} (expected 70)`);

  // 13. Verify inventory reflects all adjustments (170 + 30 - 50 - 10 = 140)
  console.log('\n13. Verify inventory after adjustments (expected 140)');
  const prodRes2 = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`   Inventory quantity: ${prodRes2.data?.product?.inventory?.quantity}`);

  // 14. PUT batch (update expiry to past → status auto-changes to expired)
  console.log('\n14. PUT /batches/[id] (change expiry to past → status updates)');
  const updateRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/batches/${batch2Id}`, {
    expiryDate: pastDate.toISOString().split('T')[0],
  });
  console.log(`   Status: ${updateRes.status}`);
  console.log(`   New batch status: ${updateRes.data?.batch?.status} (expected expired)`);

  // 15. Cleanup: DELETE all test batches
  console.log('\n15. DELETE test batches (cleanup)');
  for (const bid of [batch1Id, batch2Id, batch3Res.data?.batch?.id]) {
    if (bid) {
      const delRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${bid}`);
      console.log(`   Deleted ${bid}: ${delRes.status}`);
    }
  }

  // 16. Verify inventory restored
  console.log('\n16. Verify inventory restored to 0 after cleanup');
  const prodRes3 = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product.id}`);
  console.log(`   Inventory quantity: ${prodRes3.data?.product?.inventory?.quantity} (expected 0)`);

  console.log('\n=== All Phase 2a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
