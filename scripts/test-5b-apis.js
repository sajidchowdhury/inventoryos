// Test Phase 5b APIs: Supplier Payments, Balance Aging, Purchase Returns
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
  console.log('=== Phase 5b API Tests ===\n');

  // ── SETUP: Create supplier + purchase with partial payment ──
  console.log('--- Setup ---');
  const supplier = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/suppliers`, {
    name: 'Test Supplier 5b', phone: '01755555555',
  });
  const supplierId = supplier.data?.supplier?.id;
  console.log(`Supplier: ${supplier.data?.supplier?.name} (${supplierId?.slice(-6)})`);

  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=2`);
  const product1 = productsRes.data?.products?.[0];
  const product2 = productsRes.data?.products?.[1];

  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 2);
  const purchase = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/purchases`, {
    supplierId,
    items: [
      { productId: product1.id, productName: product1.name, quantity: 100, unitCost: 5, unit: product1.unit, batchNo: '5B-P1', expiryDate: futureDate.toISOString().split('T')[0], mrp: 50 },
      { productId: product2.id, productName: product2.name, quantity: 50, unitCost: 3, unit: product2.unit, batchNo: '5B-P2', expiryDate: futureDate.toISOString().split('T')[0], mrp: 30 },
    ],
    paidAmount: 300, // partial: 300 of 650
  });
  const purchaseId = purchase.data?.purchase?.id;
  console.log(`Purchase: ${purchase.data?.purchase?.purchaseNo} — Total: ৳${purchase.data?.purchase?.totalAmount}, Paid: ৳${purchase.data?.purchase?.paidAmount}`);
  console.log('');

  // ── 1. SUPPLIER BALANCE (with aging) ──
  console.log('1. GET /suppliers/[id]/balance (balance + aging)');
  const balanceRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}/balance`);
  console.log(`   Status: ${balanceRes.status}`);
  console.log(`   Supplier: ${balanceRes.data?.supplier?.name}`);
  console.log(`   Summary:`);
  console.log(`     totalDue: ৳${balanceRes.data?.summary?.totalDue?.toFixed(2)} (expected 350 = 650-300)`);
  console.log(`     totalInvoiced: ৳${balanceRes.data?.summary?.totalInvoiced?.toFixed(2)}`);
  console.log(`     totalPaid: ৳${balanceRes.data?.summary?.totalPaid?.toFixed(2)}`);
  console.log(`     outstandingCount: ${balanceRes.data?.summary?.outstandingCount}`);
  console.log(`     oldestDueDays: ${balanceRes.data?.summary?.oldestDueDays}`);
  console.log(`   Aging buckets:`);
  console.log(`     current (0-30d): ৳${balanceRes.data?.aging?.current?.amount?.toFixed(2)} (${balanceRes.data?.aging?.current?.count} purchases)`);
  console.log(`     31-60: ৳${balanceRes.data?.aging?.["31-60"]?.amount?.toFixed(2)}`);
  console.log(`     61-90: ৳${balanceRes.data?.aging?.["61-90"]?.amount?.toFixed(2)}`);
  console.log(`     90+: ৳${balanceRes.data?.aging?.["90+"]?.amount?.toFixed(2)}`);
  console.log(`   Outstanding purchases: ${balanceRes.data?.outstandingPurchases?.length}`);
  console.log(`   Purchase history: ${balanceRes.data?.purchaseHistory?.length}`);
  console.log('');

  // ── 2. SUPPLIER PAYMENT (FIFO) ──
  console.log('2. POST /suppliers/[id]/payments (FIFO payment of ৳200)');
  const payRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}/payments`, {
    amount: 200,
    method: 'cash',
    reference: 'CASH-5B-001',
  });
  console.log(`   Status: ${payRes.status}`);
  console.log(`   New balance: ৳${payRes.data?.supplier?.balance?.toFixed(2)} (expected 150 = 350-200)`);
  console.log(`   Total paid: ৳${payRes.data?.supplier?.totalPaid?.toFixed(2)} (expected 500 = 300+200)`);
  console.log(`   Allocation mode: ${payRes.data?.payment?.allocationMode}`);
  console.log(`   Message: ${payRes.data?.message}`);
  console.log('');

  // ── 3. VERIFY PURCHASE PAYMENT STATUS UPDATED ──
  console.log('3. Verify purchase payment status updated');
  const purchaseAfter = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}`);
  console.log(`   Purchase paidAmount: ৳${purchaseAfter.data?.purchase?.paidAmount?.toFixed(2)} (expected 500 = 300+200)`);
  console.log(`   Purchase paymentStatus: ${purchaseAfter.data?.purchase?.paymentStatus} (expected partial)`);
  console.log('');

  // ── 4. OVERPAYMENT PREVENTION ──
  console.log('4. POST /suppliers/[id]/payments (overpayment → 400)');
  const overpayRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}/payments`, {
    amount: 9999,
    method: 'cash',
  });
  console.log(`   Status: ${overpayRes.status} (expected 400)`);
  console.log(`   Error: ${overpayRes.data?.error?.substring(0, 80)}...`);
  console.log('');

  // ── 5. PAY REMAINING BALANCE ──
  console.log('5. POST /suppliers/[id]/payments (pay remaining ৳150)');
  const payRes2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}/payments`, {
    amount: 150,
    method: 'bank_transfer',
    reference: 'BT-5B-002',
  });
  console.log(`   Status: ${payRes2.status}`);
  console.log(`   New balance: ৳${payRes2.data?.supplier?.balance?.toFixed(2)} (expected 0)`);
  console.log('');

  // ── 6. SUPPLIER STATS ──
  console.log('6. GET /suppliers/stats');
  const statsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers/stats`);
  console.log(`   Status: ${statsRes.status}`);
  console.log(`   Total suppliers: ${statsRes.data?.totals?.supplierCount}`);
  console.log(`   Total purchased: ৳${statsRes.data?.totals?.totalPurchased?.toFixed(2)}`);
  console.log(`   Total paid: ৳${statsRes.data?.totals?.totalPaid?.toFixed(2)}`);
  console.log(`   Total outstanding: ৳${statsRes.data?.totals?.totalOutstanding?.toFixed(2)}`);
  console.log(`   Outstanding suppliers: ${statsRes.data?.totals?.outstandingSuppliers}`);
  console.log(`   Top suppliers: ${statsRes.data?.topSuppliers?.length}`);
  console.log(`   Top outstanding: ${statsRes.data?.topOutstanding?.length}`);
  console.log('');

  // ── 7. PURCHASE RETURNS ──
  console.log('7. GET /purchases/[id]/returns (fetch items for return)');
  const itemsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}/returns`);
  console.log(`   Status: ${itemsRes.status}`);
  console.log(`   Items available for return: ${itemsRes.data?.items?.length}`);
  itemsRes.data?.items?.forEach((item) => {
    console.log(`     ${item.productName} — Batch ${item.batchNo} — ${item.batchCurrentQty} ${item.unit} in stock — ৳${item.unitCost}/unit`);
  });
  console.log('');

  // ── 8. PROCESS PURCHASE RETURN ──
  console.log('8. POST /purchases/[id]/returns (return 20 units of first item)');
  const firstItemId = itemsRes.data?.items?.[0]?.id;
  const retRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}/returns`, {
    items: [{ purchaseItemId: firstItemId, quantity: 20 }],
    reason: 'defective',
    notes: '20 units defective',
    restockToSupplier: true,
  });
  console.log(`   Status: ${retRes.status}`);
  console.log(`   Refund amount: ৳${retRes.data?.return?.refundAmount?.toFixed(2)} (expected 100 = 20×5)`);
  console.log(`   Reason: ${retRes.data?.return?.reason}`);
  console.log(`   Items returned: ${retRes.data?.return?.itemsReturned}`);
  console.log(`   Message: ${retRes.data?.message}`);
  console.log('');

  // ── 9. VERIFY STOCK REDUCED AFTER RETURN ──
  console.log('9. Verify stock reduced after return');
  const prod1After = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/${product1.id}`);
  console.log(`   ${product1.name} inventory: ${prod1After.data?.product?.inventory?.quantity}`);
  const returnedBatch = prod1After.data?.product?.batches?.find((b) => b.batchNo === '5B-P1');
  console.log(`   Batch 5B-P1: ${returnedBatch?.quantity} ${product1.unit} (expected 80 = 100-20)`);
  console.log('');

  // ── 10. VERIFY SUPPLIER BALANCE UPDATED (refund reduced balance) ──
  console.log('10. Verify supplier balance after return (should be negative = supplier owes us)');
  const balanceAfter = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}/balance`);
  console.log(`   totalDue: ৳${balanceAfter.data?.summary?.totalDue?.toFixed(2)}`);
  console.log(`   totalInvoiced: ৳${balanceAfter.data?.summary?.totalInvoiced?.toFixed(2)} (expected 550 = 650-100)`);
  console.log(`   totalPaid: ৳${balanceAfter.data?.summary?.totalPaid?.toFixed(2)}`);
  console.log('');

  // ── 11. OVER-RETURN PREVENTION ──
  console.log('11. POST /purchases/[id]/returns (return 999 units → 400)');
  const overRetRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}/returns`, {
    items: [{ purchaseItemId: firstItemId, quantity: 999 }],
    reason: 'other',
  });
  console.log(`   Status: ${overRetRes.status} (expected 400)`);
  console.log(`   Error: ${overRetRes.data?.error?.substring(0, 80)}...`);
  console.log('');

  // ── CLEANUP ──
  console.log('--- Cleanup ---');
  // Cancel purchase (reverses everything)
  await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/purchases/${purchaseId}`, {
    action: 'cancel', cancelReason: '5b test cleanup',
  });
  console.log('   Cancelled test purchase');
  // Delete supplier
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/suppliers/${supplierId}`);
  console.log('   Deleted test supplier');

  console.log('\n=== All Phase 5b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
