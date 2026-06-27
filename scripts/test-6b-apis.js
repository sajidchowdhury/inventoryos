// Test Phase 6b APIs: Tax/VAT Report, Audit Trail, Data Export
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
  console.log('=== Phase 6b API Tests ===\n');

  // 1. Tax/VAT Report
  console.log('1. GET /reports/tax?period=month');
  const taxRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/tax?period=month`);
  console.log(`   Status: ${taxRes.status}`);
  console.log(`   Period: ${taxRes.data?.report?.periodLabel}`);
  console.log(`   Summary:`);
  console.log(`     Total sales: ৳${taxRes.data?.report?.summary?.totalSales?.toFixed(2)}`);
  console.log(`     Taxable sales: ৳${taxRes.data?.report?.summary?.taxableSales?.toFixed(2)}`);
  console.log(`     Exempt sales: ৳${taxRes.data?.report?.summary?.exemptSales?.toFixed(2)}`);
  console.log(`     Output VAT: ৳${taxRes.data?.report?.summary?.outputTax?.toFixed(2)}`);
  console.log(`     Total purchases: ৳${taxRes.data?.report?.summary?.totalPurchases?.toFixed(2)}`);
  console.log(`     Input VAT: ৳${taxRes.data?.report?.summary?.inputTax?.toFixed(2)}`);
  console.log(`     Net VAT payable: ৳${taxRes.data?.report?.summary?.netVatPayable?.toFixed(2)}`);
  console.log(`     Is refund: ${taxRes.data?.report?.summary?.isRefund}`);
  console.log(`   VAT by rate: ${taxRes.data?.report?.vatByRate?.length} rates`);
  console.log(`   Output tax details: ${taxRes.data?.report?.outputTaxDetails?.length} sales`);
  console.log(`   Input tax details: ${taxRes.data?.report?.inputTaxDetails?.length} purchases`);
  console.log('');

  // 2. Tax CSV
  console.log('2. GET /reports/tax?format=csv');
  const taxCsv = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/tax?period=month&format=csv`, null, false);
  console.log(`   Status: ${taxCsv.status}`);
  console.log(`   CSV starts with: ${taxCsv.raw.split('\n')[0]}`);
  console.log(`   CSV lines: ${taxCsv.raw.split('\n').length}`);
  console.log('');

  // 3. Audit Trail (all modules)
  console.log('3. GET /reports/audit (all modules)');
  const auditRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/audit?limit=20`);
  console.log(`   Status: ${auditRes.status}`);
  console.log(`   Total events: ${auditRes.data?.totalEvents}`);
  console.log(`   Events returned: ${auditRes.data?.events?.length}`);
  console.log(`   Summary by module:`, JSON.stringify(auditRes.data?.summary?.byModule, null, 2));
  console.log(`   Summary by type (top 5):`);
  const typeEntries = Object.entries(auditRes.data?.summary?.byType || {}).slice(0, 5);
  typeEntries.forEach(([type, count]) => console.log(`     ${type}: ${count}`));
  console.log(`   Total amount: ৳${auditRes.data?.summary?.totalAmount?.toFixed(2)}`);
  console.log('');

  // 4. Audit Trail (filtered by module=sales)
  console.log('4. GET /reports/audit?module=sales');
  const auditSales = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/audit?module=sales&limit=10`);
  console.log(`   Status: ${auditSales.status}`);
  console.log(`   Total events: ${auditSales.data?.totalEvents}`);
  console.log(`   All from Sales module: ${auditSales.data?.events?.every((e) => e.module === "Sales")}`);
  console.log('');

  // 5. Audit Trail (filtered by module=inventory)
  console.log('5. GET /reports/audit?module=inventory');
  const auditInv = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/audit?module=inventory&limit=10`);
  console.log(`   Status: ${auditInv.status}`);
  console.log(`   Total events: ${auditInv.data?.totalEvents}`);
  console.log(`   All from Inventory module: ${auditInv.data?.events?.every((e) => e.module === "Inventory")}`);
  console.log('');

  // 6. Data Export (JSON)
  console.log('6. GET /export?format=json (full backup)');
  const exportJson = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/export?format=json&modules=products,categories,batches,sales,customers`, null, false);
  console.log(`   Status: ${exportJson.status}`);
  const exportData = JSON.parse(exportJson.raw);
  console.log(`   Business: ${exportData._meta?.business?.name}`);
  console.log(`   Exported at: ${exportData._meta?.exportedAt}`);
  console.log(`   Record counts:`);
  Object.entries(exportData._meta?.recordCounts || {}).forEach(([key, count]) => {
    console.log(`     ${key}: ${count} records`);
  });
  console.log(`   Total records: ${exportData._meta?.totalRecords}`);
  console.log('');

  // 7. Data Export (CSV summary)
  console.log('7. GET /export?format=csv (summary)');
  const exportCsv = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/export?format=csv&modules=products,categories,sales`, null, false);
  console.log(`   Status: ${exportCsv.status}`);
  console.log(`   CSV starts with: ${exportCsv.raw.split('\n')[0]}`);
  console.log(`   CSV lines: ${exportCsv.raw.split('\n').length}`);
  console.log('');

  // 8. Data Export (all modules)
  console.log('8. GET /export?format=json (all modules)');
  const exportAll = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/export?format=json`, null, false);
  console.log(`   Status: ${exportAll.status}`);
  const allData = JSON.parse(exportAll.raw);
  console.log(`   Total records across all modules: ${allData._meta?.totalRecords}`);
  console.log(`   Modules exported: ${Object.keys(allData._meta?.recordCounts || {}).length}`);
  console.log('');

  console.log('=== All Phase 6b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
