// Test Phase 4a APIs: Customers, Sales (with FEFO), Sale cancel, Stats
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
  console.log('=== Phase 4a API Tests ===\n');

  // ── 1. CUSTOMERS ──
  console.log('1. POST /customers (create customer)');
  const custRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/customers`, {
    name: 'Rahim Ahmed',
    phone: '01711111111',
    email: 'rahim@test.com',
    address: 'House 12, Road 5, Dhanmondi, Dhaka',
    gender: 'male',
    chronicConditions: 'diabetes, hypertension',
    allergies: 'penicillin',
    notes: 'Regular customer',
  });
  console.log(`   Status: ${custRes.status}`);
  console.log(`   Customer: ${custRes.data?.customer?.name} (${custRes.data?.customer?.id?.slice(-6)})`);
  const customerId = custRes.data?.customer?.id;

  // 2. Duplicate phone should fail
  console.log('\n2. POST /customers (duplicate phone → 409)');
  const dupRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/customers`, {
    name: 'Someone Else',
    phone: '01711111111',
  });
  console.log(`   Status: ${dupRes.status} (expected 409)`);
  console.log(`   Error: ${dupRes.data?.error}`);

  // 3. List customers
  console.log('\n3. GET /customers (list)');
  const listRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/customers`);
  console.log(`   Status: ${listRes.status}`);
  console.log(`   Total: ${listRes.data?.pagination?.total}`);

  // 4. Get individual customer
  console.log('\n4. GET /customers/[id] (individual)');
  const getCRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/customers/${customerId}`);
  console.log(`   Status: ${getCRes.status}`);
  console.log(`   Name: ${getCRes.data?.customer?.name}`);
  console.log(`   Chronic conditions: ${getCRes.data?.customer?.chronicConditions}`);
  console.log(`   Allergies: ${getCRes.data?.customer?.allergies}`);

  // 5. Update customer
  console.log('\n5. PUT /customers/[id] (update)');
  const updRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/customers/${customerId}`, {
    name: 'Rahim Ahmed (Updated)',
    phone: '01722222222',
  });
  console.log(`   Status: ${updRes.status}`);
  console.log(`   Updated name: ${updRes.data?.customer?.name}`);
  console.log(`   Updated phone: ${updRes.data?.customer?.phone}`);

  // ── 6. SALES (with FEFO) ──
  console.log('\n--- Sales Tests ---');

  // Setup: Add batches to products for FEFO testing
  console.log('\n6. Setup: Create batches for FEFO sale test');
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=3`);
  const products = productsRes.data?.products || [];
  const product1 = products[0]; // Ace Plus
  const product2 = products[1]; // Amodis

  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 2);
  const nearDate = new Date(); nearDate.setDate(nearDate.getDate() + 60);

  const batch1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product1.id, batchNo: '4A-FAR',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 100, purchasePrice: 5, mrp: 50,
  });
  const batch2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product1.id, batchNo: '4A-NEAR',
    expiryDate: nearDate.toISOString().split('T')[0],
    quantity: 50, purchasePrice: 5, mrp: 50,
  });
  const batch3 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product2.id, batchNo: '4A-PROD2',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 80, purchasePrice: 3, mrp: 30,
  });
  console.log(`   Created batches: 4A-FAR (100), 4A-NEAR (50), 4A-PROD2 (80)`);

  // 7. Create a sale (multi-item with FEFO)
  console.log('\n7. POST /sales (create multi-item sale with FEFO)');
  console.log('   Items: 70 units of product1 (should take 50 from NEAR + 20 from FAR), 15 of product2');
  const saleRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/sales`, {
    customerId,
    items: [
      { productId: product1.id, quantity: 70 },
      { productId: product2.id, quantity: 15 },
    ],
    paymentMethod: 'cash',
    paidAmount: 4000, // partial payment to test paymentStatus
    notes: 'Test sale with FEFO',
  });
  console.log(`   Status: ${saleRes.status}`);
  console.log(`   Invoice: ${saleRes.data?.sale?.invoiceNo}`);
  console.log(`   Subtotal: ৳${saleRes.data?.sale?.subtotal?.toFixed(2)}`);
  console.log(`   Total: ৳${saleRes.data?.sale?.totalAmount?.toFixed(2)}`);
  console.log(`   Paid: ৳${saleRes.data?.sale?.paidAmount?.toFixed(2)}`);
  console.log(`   Payment status: ${saleRes.data?.sale?.paymentStatus} (expected partial)`);
  console.log(`   Item count: ${saleRes.data?.sale?.itemCount}`);
  console.log(`   Items:`);
  saleRes.data?.sale?.items?.forEach((item) => {
    console.log(`     ${item.productName} — Batch ${item.batchNo} — ${item.quantity} ${item.unit} × ৳${item.unitPrice} = ৳${item.totalPrice.toFixed(2)}`);
  });
  const saleId = saleRes.data?.sale?.id;
  const invoiceNo = saleRes.data?.sale?.invoiceNo;

  // 8. Verify FEFO: batch 4A-NEAR should be depleted (50 → 0), 4A-FAR reduced (100 → 80)
  console.log('\n8. Verify FEFO allocation (NEAR batch depleted first)');
  const prod1Res = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  console.log(`   ${product1.name} batches after sale:`);
  prod1Res.data?.product?.batches?.forEach((b) => {
    console.log(`     ${b.batchNo}: ${b.quantity} ${product1.unit} (status: ${b.status})`);
  });
  console.log(`   Expected: 4A-NEAR=0 (depleted), 4A-FAR=80 (100-20)`);

  // 9. Verify inventory updated
  console.log(`\n9. Verify inventory updated`);
  console.log(`   ${product1.name} inventory: ${prod1Res.data?.product?.inventory?.quantity} (expected 80 = 150-70)`);
  const prod2Res = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product2.id}`);
  console.log(`   ${product2.name} inventory: ${prod2Res.data?.product?.inventory?.quantity} (expected 65 = 80-15)`);

  // 10. Verify customer stats updated
  console.log('\n10. Verify customer stats updated');
  const custAfter = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/customers/${customerId}`);
  console.log(`   totalSpent: ৳${custAfter.data?.customer?.totalSpent?.toFixed(2)}`);
  console.log(`   visitCount: ${custAfter.data?.customer?.visitCount} (expected 1)`);
  console.log(`   lastVisitAt: ${custAfter.data?.customer?.lastVisitAt ? 'set' : 'null'}`);

  // 11. Get sale details
  console.log('\n11. GET /sales/[id] (view invoice)');
  const getSaleRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sales/${saleId}`);
  console.log(`   Status: ${getSaleRes.status}`);
  console.log(`   Invoice: ${getSaleRes.data?.sale?.invoiceNo}`);
  console.log(`   Customer: ${getSaleRes.data?.sale?.customer?.name}`);
  console.log(`   Items: ${getSaleRes.data?.sale?.items?.length}`);

  // 12. List sales
  console.log('\n12. GET /sales (list with summary)');
  const listSalesRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sales?limit=5`);
  console.log(`   Status: ${listSalesRes.status}`);
  console.log(`   Total sales: ${listSalesRes.data?.pagination?.total}`);
  console.log(`   Today: ${listSalesRes.data?.summary?.today?.count} sale(s), ৳${listSalesRes.data?.summary?.today?.total?.toFixed(2)}`);
  console.log(`   All-time: ${listSalesRes.data?.summary?.allTime?.count} sale(s), ৳${listSalesRes.data?.summary?.allTime?.total?.toFixed(2)}`);

  // 13. Test insufficient stock (should fail)
  console.log('\n13. POST /sales (insufficient stock → 409)');
  const failRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/sales`, {
    items: [{ productId: product1.id, quantity: 9999 }],
  });
  console.log(`   Status: ${failRes.status} (expected 409)`);
  console.log(`   Error: ${failRes.data?.error}`);

  // 14. Sales stats
  console.log('\n14. GET /sales/stats (aggregations)');
  const statsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sales/stats`);
  console.log(`   Status: ${statsRes.status}`);
  console.log(`   Today: ${statsRes.data?.periods?.today?.count} sales, ৳${statsRes.data?.periods?.today?.total?.toFixed(2)}`);
  console.log(`   Week: ${statsRes.data?.periods?.week?.count} sales, ৳${statsRes.data?.periods?.week?.total?.toFixed(2)}`);
  console.log(`   Month: ${statsRes.data?.periods?.month?.count} sales, ৳${statsRes.data?.periods?.month?.total?.toFixed(2)}`);
  console.log(`   Last 7 days:`);
  statsRes.data?.last7Days?.forEach((d) => {
    if (d.count > 0) console.log(`     ${d.dayName} (${d.date}): ${d.count} sales, ৳${d.total.toFixed(2)}`);
  });
  console.log(`   Top products:`);
  statsRes.data?.topProducts?.forEach((p) => {
    console.log(`     ${p.productName}: ${p.quantity} units, ৳${p.revenue.toFixed(2)} revenue`);
  });
  console.log(`   Outstanding: ${statsRes.data?.outstanding?.count} sales, ৳${statsRes.data?.outstanding?.dueAmount?.toFixed(2)} due`);

  // 15. Cancel the sale (should restore stock)
  console.log('\n15. PUT /sales/[id] (cancel sale — should restore stock)');
  const cancelRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/sales/${saleId}`, {
    action: 'cancel',
    cancelReason: 'Test cancellation — customer returned items',
  });
  console.log(`   Status: ${cancelRes.status}`);
  console.log(`   Message: ${cancelRes.data?.message}`);

  // 16. Verify stock restored
  console.log('\n16. Verify stock restored after cancellation');
  const prod1After = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  console.log(`   ${product1.name} inventory: ${prod1After.data?.product?.inventory?.quantity} (expected 150 = 80+70 restored)`);
  console.log(`   Batches:`);
  prod1After.data?.product?.batches?.forEach((b) => {
    console.log(`     ${b.batchNo}: ${b.quantity} ${product1.unit}`);
  });
  console.log(`   Expected: 4A-NEAR=50 (restored), 4A-FAR=100 (restored)`);

  // 17. Verify customer stats reversed
  console.log('\n17. Verify customer stats reversed after cancellation');
  const custFinal = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/customers/${customerId}`);
  console.log(`   totalSpent: ৳${custFinal.data?.customer?.totalSpent?.toFixed(2)} (expected 0)`);
  console.log(`   visitCount: ${custFinal.data?.customer?.visitCount} (expected 0)`);

  // 18. Try to cancel already-cancelled sale (should fail)
  console.log('\n18. PUT /sales/[id] (cancel already-cancelled → 400)');
  const reCancelRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/sales/${saleId}`, {
    action: 'cancel',
    cancelReason: 'Try again',
  });
  console.log(`   Status: ${reCancelRes.status} (expected 400)`);

  // ── CLEANUP ──
  console.log('\n--- Cleanup ---');
  // Delete test sale
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/sales/${saleId}`).catch(() => {});
  // Note: Sale DELETE not implemented — sales are soft-deleted via cancel

  // Delete test batches
  for (const bid of [batch1.data?.batch?.id, batch2.data?.batch?.id, batch3.data?.batch?.id]) {
    if (bid) await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${bid}`);
  }
  console.log('   Deleted 3 test batches');

  // Delete test customer
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/customers/${customerId}`);
  console.log('   Deleted test customer');

  console.log('\n=== All Phase 4a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
