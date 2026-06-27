// Test Phase 4b APIs: Payments, Customer Credit, Returns with restocking
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
  console.log('=== Phase 4b API Tests ===\n');

  // ── SETUP: Create customer, batches, and a sale with partial payment ──
  console.log('--- Setup ---');
  const customer = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/customers`, {
    name: 'Karim Test', phone: '01733333333',
  });
  const customerId = customer.data?.customer?.id;
  console.log(`Created customer: ${customer.data?.customer?.name} (${customerId?.slice(-6)})`);

  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=2`);
  const product1 = productsRes.data?.products?.[0];
  const product2 = productsRes.data?.products?.[1];

  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 2);
  const batch1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product1.id, batchNo: '4B-TEST',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 100, purchasePrice: 5, mrp: 50,
  });
  const batch2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product2.id, batchNo: '4B-TEST2',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 50, purchasePrice: 3, mrp: 30,
  });
  console.log(`Created batches: 4B-TEST (100), 4B-TEST2 (50)`);

  // Create sale with PARTIAL payment (pay 1000 of 2000 total)
  console.log('\nCreating sale with partial payment...');
  const sale = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/sales`, {
    customerId,
    items: [
      { productId: product1.id, quantity: 20 }, // 20 × 50 = 1000
      { productId: product2.id, quantity: 10 }, // 10 × 30 = 300
    ],
    paymentMethod: 'cash',
    paidAmount: 500, // partial: 500 of 1300
    notes: 'Test sale for 4b',
  });
  const saleId = sale.data?.sale?.id;
  const invoiceNo = sale.data?.sale?.invoiceNo;
  console.log(`Sale: ${invoiceNo} — Total: ৳${sale.data?.sale?.totalAmount}, Paid: ৳${sale.data?.sale?.paidAmount}, Status: ${sale.data?.sale?.paymentStatus}`);
  console.log('');

  // ── 1. PAYMENTS ──
  console.log('1. POST /payments (record partial payment of ৳400)');
  const pay1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/payments`, {
    saleId,
    amount: 400,
    paymentMethod: 'cash',
    reference: 'CASH-001',
    notes: 'Second installment',
  });
  console.log(`   Status: ${pay1.status}`);
  console.log(`   Sale paidAmount now: ৳${pay1.data?.sale?.paidAmount?.toFixed(2)} (expected 900 = 500+400)`);
  console.log(`   Sale paymentStatus: ${pay1.data?.sale?.paymentStatus} (expected partial)`);
  console.log(`   Due: ৳${pay1.data?.sale?.dueAmount?.toFixed(2)} (expected 400 = 1300-900)`);
  console.log('');

  // 2. Record final payment to mark as paid
  console.log('2. POST /payments (record final ৳400 to fully pay)');
  const pay2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/payments`, {
    saleId,
    amount: 400,
    paymentMethod: 'mobile_banking',
    reference: 'BKASH-12345',
  });
  console.log(`   Status: ${pay2.status}`);
  console.log(`   Sale paidAmount: ৳${pay2.data?.sale?.paidAmount?.toFixed(2)} (expected 1300)`);
  console.log(`   Sale paymentStatus: ${pay2.data?.sale?.paymentStatus} (expected paid)`);
  console.log(`   Due: ৳${pay2.data?.sale?.dueAmount?.toFixed(2)} (expected 0)`);
  console.log('');

  // 3. Try overpayment (should fail)
  console.log('3. POST /payments (overpayment → 400)');
  const overpay = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/payments`, {
    saleId,
    amount: 999,
    paymentMethod: 'cash',
  });
  console.log(`   Status: ${overpay.status} (expected 400)`);
  console.log(`   Error: ${overpay.data?.error?.substring(0, 80)}...`);
  console.log('');

  // 4. List payments for sale
  console.log('4. GET /payments?saleId=X (list payments for sale)');
  const payList = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/payments?saleId=${saleId}`);
  console.log(`   Status: ${payList.status}`);
  console.log(`   Total payments: ${payList.data?.pagination?.total}`);
  console.log(`   Today's total: ৳${payList.data?.summary?.today?.total?.toFixed(2)}`);
  console.log(`   By method:`);
  payList.data?.summary?.byMethod?.forEach((m) => {
    console.log(`     ${m.method}: ৳${m.total.toFixed(2)} (${m.count} payments)`);
  });
  console.log('');

  // 5. Payment stats
  console.log('5. GET /payments/stats');
  const payStats = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/payments/stats`);
  console.log(`   Status: ${payStats.status}`);
  console.log(`   Today: ৳${payStats.data?.periods?.today?.total?.toFixed(2)} (${payStats.data?.periods?.today?.count} payments)`);
  console.log(`   Week: ৳${payStats.data?.periods?.week?.total?.toFixed(2)}`);
  console.log(`   Month: ৳${payStats.data?.periods?.month?.total?.toFixed(2)}`);
  console.log(`   By method:`);
  payStats.data?.byMethod?.forEach((m) => {
    console.log(`     ${m.method}: ৳${m.total.toFixed(2)}`);
  });
  console.log(`   Top payers: ${payStats.data?.topPayers?.length}`);
  console.log('');

  // ── 6. CUSTOMER CREDIT ──
  console.log('6. GET /customers/[id]/credit (customer credit summary)');
  const credit = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/customers/${customerId}/credit`);
  console.log(`   Status: ${credit.status}`);
  console.log(`   Customer: ${credit.data?.customer?.name}`);
  console.log(`   Credit summary:`);
  console.log(`     totalDue: ৳${credit.data?.credit?.totalDue?.toFixed(2)}`);
  console.log(`     totalInvoiced: ৳${credit.data?.credit?.totalInvoiced?.toFixed(2)}`);
  console.log(`     totalPaid: ৳${credit.data?.credit?.totalPaid?.toFixed(2)}`);
  console.log(`     outstandingSaleCount: ${credit.data?.credit?.outstandingSaleCount}`);
  console.log(`   Payment history: ${credit.data?.paymentHistory?.length} payments`);
  console.log('');

  // ── 7. RETURNS ──
  // First, get sale items to return
  console.log('7. Setup: Get sale items for return');
  const saleDetail = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sales/${saleId}`);
  const saleItems = saleDetail.data?.sale?.items || [];
  console.log(`   Sale has ${saleItems.length} items:`);
  saleItems.forEach((item) => {
    console.log(`     ${item.productName} — Batch ${item.batchNo} — ${item.quantity} ${item.unit} × ৳${item.unitPrice}`);
  });

  // 8. Process a return (return 5 units of first item, restock=true)
  console.log('\n8. POST /returns (return 5 units of first item, restock=true)');
  const ret1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/returns`, {
    saleId,
    items: [{ saleItemId: saleItems[0].id, quantity: 5 }],
    reason: 'customer_changed_mind',
    refundMethod: 'cash',
    restockItems: true,
    notes: 'Customer returned 5 units',
  });
  console.log(`   Status: ${ret1.status}`);
  console.log(`   Return No: ${ret1.data?.return?.returnNo}`);
  console.log(`   Refund amount: ৳${ret1.data?.return?.refundAmount?.toFixed(2)} (expected 250 = 5×50)`);
  console.log(`   Restock: ${ret1.data?.return?.restockItems}`);
  console.log(`   Message: ${ret1.data?.message}`);
  console.log('');

  // 9. Verify stock was restocked
  console.log('9. Verify stock restocked after return');
  const prod1After = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  console.log(`   ${product1.name} inventory: ${prod1After.data?.product?.inventory?.quantity}`);
  console.log(`   Batches:`);
  prod1After.data?.product?.batches?.forEach((b) => {
    console.log(`     ${b.batchNo}: ${b.quantity} ${product1.unit}`);
  });
  console.log(`   Expected: 4B-TEST batch increased by 5 (returned)`);
  console.log('');

  // 10. Try to return more than available (should fail)
  console.log('10. POST /returns (return 999 units → 400)');
  const overRet = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/returns`, {
    saleId,
    items: [{ saleItemId: saleItems[0].id, quantity: 999 }],
    reason: 'other',
  });
  console.log(`   Status: ${overRet.status} (expected 400)`);
  console.log(`   Error: ${overRet.data?.error?.substring(0, 80)}...`);
  console.log('');

  // 11. List returns
  console.log('11. GET /returns (list returns)');
  const retList = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/returns?saleId=${saleId}`);
  console.log(`   Status: ${retList.status}`);
  console.log(`   Total returns: ${retList.data?.pagination?.total}`);
  console.log(`   Today: ${retList.data?.summary?.today?.count} return(s), ৳${retList.data?.summary?.today?.refund?.toFixed(2)}`);
  console.log('');

  // 12. Try to return from cancelled sale (should fail)
  console.log('12. Test: Cancel sale, then try to return (should fail)');
  const cancelRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/sales/${saleId}`, {
    action: 'cancel',
    cancelReason: 'Test cancellation for 4b',
  });
  console.log(`   Cancelled sale: ${cancelRes.data?.message?.substring(0, 50)}...`);
  const retAfterCancel = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/returns`, {
    saleId,
    items: [{ saleItemId: saleItems[1].id, quantity: 1 }],
    reason: 'other',
  });
  console.log(`   Return after cancel: Status ${retAfterCancel.status} (expected 400)`);
  console.log(`   Error: ${retAfterCancel.data?.error}`);
  console.log('');

  // ── CLEANUP ──
  console.log('--- Cleanup ---');
  // Note: sale is now cancelled — stock already restored
  // Delete test batches
  for (const bid of [batch1.data?.batch?.id, batch2.data?.batch?.id]) {
    if (bid) await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${bid}`);
  }
  console.log('   Deleted 2 test batches');
  // Delete customer
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/customers/${customerId}`);
  console.log('   Deleted test customer');

  console.log('\n=== All Phase 4b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
