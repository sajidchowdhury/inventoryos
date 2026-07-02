// Test Phase 4c APIs: Sales Analytics, Discount Rules CRUD
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
  console.log('=== Phase 4c API Tests ===\n');

  // ── DISCOUNT RULES ──
  console.log('--- Discount Rules ---');

  // 1. Create a percent discount rule
  console.log('1. POST /discount-rules (create 10% bulk discount)');
  const rule1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/discount-rules`, {
    name: 'Bulk 10% off',
    description: '10% discount on orders with 10+ items',
    type: 'percent',
    value: 10,
    conditionType: 'min_quantity',
    conditionValue: '10',
    scope: 'all',
    isActive: true,
    priority: 10,
  });
  console.log(`   Status: ${rule1.status}`);
  console.log(`   Rule: ${rule1.data?.rule?.name} (id: ${rule1.data?.rule?.id?.slice(-6)})`);
  console.log(`   Type: ${rule1.data?.rule?.type} ${rule1.data?.rule?.value}${rule1.data?.rule?.type === 'percent' ? '%' : '৳'}`);
  const rule1Id = rule1.data?.rule?.id;

  // 2. Create a flat discount rule
  console.log('\n2. POST /discount-rules (create flat ৳50 discount)');
  const rule2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/discount-rules`, {
    name: 'Senior Citizen ৳50 off',
    type: 'flat',
    value: 50,
    conditionType: 'customer_tag',
    conditionValue: 'senior',
    scope: 'all',
    isActive: true,
    priority: 5,
  });
  console.log(`   Status: ${rule2.status}`);
  console.log(`   Rule: ${rule2.data?.rule?.name}`);
  const rule2Id = rule2.data?.rule?.id;

  // 3. Test invalid percent (>100)
  console.log('\n3. POST /discount-rules (150% → 400)');
  const invalidRule = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/discount-rules`, {
    name: 'Invalid',
    type: 'percent',
    value: 150,
  });
  console.log(`   Status: ${invalidRule.status} (expected 400)`);
  console.log(`   Error: ${invalidRule.data?.error}`);

  // 4. List all rules
  console.log('\n4. GET /discount-rules (list all)');
  const listRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/discount-rules`);
  console.log(`   Status: ${listRes.status}`);
  console.log(`   Total rules: ${listRes.data?.count}`);
  listRes.data?.rules?.forEach((r) => {
    console.log(`     ${r.name} — ${r.type} ${r.value}${r.type === 'percent' ? '%' : '৳'} — ${r.isActive ? 'Active' : 'Inactive'} — priority ${r.priority}`);
  });

  // 5. Update a rule
  console.log('\n5. PUT /discount-rules/[id] (update rule 1 to 15%)');
  const updateRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/discount-rules/${rule1Id}`, {
    value: 15,
    description: 'Updated: 15% discount on bulk orders',
  });
  console.log(`   Status: ${updateRes.status}`);
  console.log(`   Updated value: ${updateRes.data?.rule?.value}%`);
  console.log(`   Updated description: ${updateRes.data?.rule?.description}`);

  // 6. Toggle active status
  console.log('\n6. PUT /discount-rules/[id] (deactivate rule 2)');
  const toggleRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/discount-rules/${rule2Id}`, {
    isActive: false,
  });
  console.log(`   Status: ${toggleRes.status}`);
  console.log(`   isActive: ${toggleRes.data?.rule?.isActive} (expected false)`);
  console.log('');

  // ── SETUP FOR ANALYTICS: Create some sales ──
  console.log('--- Setup: Create test sales for analytics ---');
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=2`);
  const product1 = productsRes.data?.products?.[0];
  const product2 = productsRes.data?.products?.[1];

  // Setup batches
  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 2);
  const batch1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product1.id, batchNo: '4C-A1',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 200, purchasePrice: 5, mrp: 50,
  });
  const batch2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product2.id, batchNo: '4C-A2',
    expiryDate: futureDate.toISOString().split('T')[0],
    quantity: 100, purchasePrice: 3, mrp: 30,
  });

  // Create 3 sales with different discount scenarios
  console.log('Creating 3 test sales...');

  // Sale 1: No discount
  const sale1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/sales`, {
    items: [{ productId: product1.id, quantity: 10 }],
    paymentMethod: 'cash', paidAmount: 500,
  });
  console.log(`   Sale 1: ${sale1.data?.sale?.invoiceNo} — ৳${sale1.data?.sale?.totalAmount} (no discount)`);

  // Sale 2: With 10% discount
  const sale2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/sales`, {
    items: [{ productId: product2.id, quantity: 20 }],
    discountPercent: 10,
    paymentMethod: 'mobile_banking', paidAmount: 540,
  });
  console.log(`   Sale 2: ${sale2.data?.sale?.invoiceNo} — ৳${sale2.data?.sale?.totalAmount} (10% discount, subtotal was ৳${sale2.data?.sale?.subtotal})`);

  // Sale 3: With flat ৳50 discount
  const sale3 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/sales`, {
    items: [{ productId: product1.id, quantity: 15 }, { productId: product2.id, quantity: 10 }],
    discountAmount: 50,
    paymentMethod: 'cash', paidAmount: 1000,
  });
  console.log(`   Sale 3: ${sale3.data?.sale?.invoiceNo} — ৳${sale3.data?.sale?.totalAmount} (৳50 flat discount, subtotal was ৳${sale3.data?.sale?.subtotal})`);
  console.log('');

  // ── SALES ANALYTICS ──
  console.log('--- Sales Analytics ---');

  // 7. Get analytics for 7d period
  console.log('7. GET /sales/analytics?period=7d');
  const analytics7d = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sales/analytics?period=7d`);
  console.log(`   Status: ${analytics7d.status}`);
  console.log(`   Period: ${analytics7d.data?.period}`);
  console.log(`   KPIs:`);
  console.log(`     totalSales: ৳${analytics7d.data?.kpis?.totalSales?.toFixed(2)}`);
  console.log(`     salesCount: ${analytics7d.data?.kpis?.salesCount}`);
  console.log(`     avgSaleValue: ৳${analytics7d.data?.kpis?.avgSaleValue?.toFixed(2)}`);
  console.log(`     totalCollected: ৳${analytics7d.data?.kpis?.totalCollected?.toFixed(2)}`);
  console.log(`     totalDiscounts: ৳${analytics7d.data?.kpis?.totalDiscounts?.toFixed(2)}`);
  console.log(`     netRevenue: ৳${analytics7d.data?.kpis?.netRevenue?.toFixed(2)}`);
  console.log(`     growthPercent: ${analytics7d.data?.kpis?.growthPercent}%`);
  console.log(`   Daily trend data points: ${analytics7d.data?.dailyTrend?.length}`);
  console.log(`   Top products: ${analytics7d.data?.topProducts?.length}`);
  analytics7d.data?.topProducts?.slice(0, 3).forEach((p) => {
    console.log(`     ${p.productName}: ${p.quantity} units, ৳${p.revenue.toFixed(2)} revenue`);
  });
  console.log(`   Payment methods:`);
  analytics7d.data?.paymentMethods?.forEach((pm) => {
    console.log(`     ${pm.method}: ৳${pm.total.toFixed(2)} (${pm.percent.toFixed(1)}%) — ${pm.count} payments`);
  });
  console.log(`   Peak hours: ${analytics7d.data?.peakHours?.length}`);
  analytics7d.data?.peakHours?.forEach((h) => {
    console.log(`     ${h.label}: ${h.count} sales, ৳${h.total.toFixed(0)}`);
  });
  console.log(`   Day of week:`);
  analytics7d.data?.dayOfWeek?.forEach((d) => {
    if (d.count > 0) console.log(`     ${d.day}: ${d.count} sales, ৳${d.total.toFixed(0)}`);
  });
  console.log('');

  // 8. Get analytics for 30d period
  console.log('8. GET /sales/analytics?period=30d');
  const analytics30d = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sales/analytics?period=30d`);
  console.log(`   Status: ${analytics30d.status}`);
  console.log(`   Total sales (30d): ৳${analytics30d.data?.kpis?.totalSales?.toFixed(2)}`);
  console.log(`   Sales count (30d): ${analytics30d.data?.kpis?.salesCount}`);
  console.log(`   Daily trend points: ${analytics30d.data?.dailyTrend?.length} (expected 30)`);
  console.log('');

  // 9. Verify discount calculations
  console.log('9. Verify discount calculations');
  const totalDiscounts = analytics7d.data?.kpis?.totalDiscounts;
  console.log(`   Total discounts given (7d): ৳${totalDiscounts?.toFixed(2)}`);
  console.log(`   Expected: Sale 2 had 10% of ৳600 = ৳60, Sale 3 had ৳50 flat = ৳50, total = ৳110`);
  console.log('');

  // 10. Delete a discount rule
  console.log('10. DELETE /discount-rules/[id] (delete rule 2)');
  const delRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/discount-rules/${rule2Id}`);
  console.log(`   Status: ${delRes.status}`);
  console.log(`   Message: ${delRes.data?.message}`);

  // 11. Verify rule deleted
  console.log('\n11. GET /discount-rules (verify deletion)');
  const listAfter = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/discount-rules`);
  console.log(`   Total rules now: ${listAfter.data?.count} (expected 1)`);

  // ── CLEANUP ──
  console.log('\n--- Cleanup ---');
  // Cancel the 3 sales (restores stock)
  for (const sale of [sale1.data?.sale?.id, sale2.data?.sale?.id, sale3.data?.sale?.id]) {
    if (sale) {
      await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/sales/${sale}`, {
        action: 'cancel', cancelReason: '4c test cleanup',
      });
    }
  }
  console.log('   Cancelled 3 test sales');

  // Delete batches
  for (const bid of [batch1.data?.batch?.id, batch2.data?.batch?.id]) {
    if (bid) await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${bid}`);
  }
  console.log('   Deleted 2 test batches');

  // Delete remaining discount rule
  if (rule1Id) await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/discount-rules/${rule1Id}`);
  console.log('   Deleted discount rule 1');

  console.log('\n=== All Phase 4c tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
