// Test Phase 6a APIs: Business Dashboard, P&L, Inventory Valuation, Business Report
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
  console.log('=== Phase 6a API Tests ===\n');

  // 1. Business Dashboard (unified KPIs)
  console.log('1. GET /dashboard (unified business KPIs)');
  const dashRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/dashboard`);
  console.log(`   Status: ${dashRes.status}`);
  console.log(`   Sales:`);
  console.log(`     Today: ৳${dashRes.data?.sales?.today?.total?.toFixed(2)} (${dashRes.data?.sales?.today?.count} orders)`);
  console.log(`     Week: ৳${dashRes.data?.sales?.week?.total?.toFixed(2)} (${dashRes.data?.sales?.week?.count} orders)`);
  console.log(`     Month: ৳${dashRes.data?.sales?.month?.total?.toFixed(2)} (${dashRes.data?.sales?.month?.count} orders)`);
  console.log(`   Purchases:`);
  console.log(`     Today: ৳${dashRes.data?.purchases?.today?.total?.toFixed(2)} (${dashRes.data?.purchases?.today?.count} orders)`);
  console.log(`     Month: ৳${dashRes.data?.purchases?.month?.total?.toFixed(2)} (${dashRes.data?.purchases?.month?.count} orders)`);
  console.log(`   Payments:`);
  console.log(`     Today: ৳${dashRes.data?.payments?.today?.total?.toFixed(2)} (${dashRes.data?.payments?.today?.count} payments)`);
  console.log(`     Month: ৳${dashRes.data?.payments?.month?.total?.toFixed(2)}`);
  console.log(`   Returns (month): ৳${dashRes.data?.returns?.month?.refund?.toFixed(2)} (${dashRes.data?.returns?.month?.count} returns)`);
  console.log(`   Inventory:`);
  console.log(`     Total products: ${dashRes.data?.inventory?.totalProducts}`);
  console.log(`     Low stock: ${dashRes.data?.inventory?.lowStockProducts}`);
  console.log(`     Out of stock: ${dashRes.data?.inventory?.outOfStockProducts}`);
  console.log(`     Total batches: ${dashRes.data?.inventory?.totalBatches}`);
  console.log(`     Cost value: ৳${dashRes.data?.inventory?.costValue?.toFixed(2)}`);
  console.log(`     MRP value: ৳${dashRes.data?.inventory?.mrpValue?.toFixed(2)}`);
  console.log(`     Potential profit: ৳${dashRes.data?.inventory?.potentialProfit?.toFixed(2)}`);
  console.log(`   Expiry:`);
  console.log(`     Expired batches: ${dashRes.data?.expiry?.expiredBatches}`);
  console.log(`     Near expiry: ${dashRes.data?.expiry?.nearExpiryBatches}`);
  console.log(`     Quarantined: ${dashRes.data?.expiry?.quarantinedBatches}`);
  console.log(`     Value at risk: ৳${dashRes.data?.expiry?.valueAtRisk?.toFixed(2)}`);
  console.log(`   Contacts: ${dashRes.data?.contacts?.totalCustomers} customers, ${dashRes.data?.contacts?.totalSuppliers} suppliers`);
  console.log(`   Financials:`);
  console.log(`     Receivables: ৳${dashRes.data?.financials?.receivables?.amount?.toFixed(2)} (${dashRes.data?.financials?.receivables?.count} invoices)`);
  console.log(`     Payables: ৳${dashRes.data?.financials?.payables?.amount?.toFixed(2)} (${dashRes.data?.financials?.payables?.count} suppliers)`);
  console.log(`     Cash flow: In ৳${dashRes.data?.financials?.cashFlow?.inflow?.toFixed(2)} · Out ৳${dashRes.data?.financials?.cashFlow?.outflow?.toFixed(2)}`);
  console.log(`   Profit (month):`);
  console.log(`     Revenue: ৳${dashRes.data?.profit?.monthRevenue?.toFixed(2)}`);
  console.log(`     COGS: ৳${dashRes.data?.profit?.monthCOGS?.toFixed(2)}`);
  console.log(`     Gross profit: ৳${dashRes.data?.profit?.monthGrossProfit?.toFixed(2)}`);
  console.log(`     Margin: ${dashRes.data?.profit?.monthProfitMargin}%`);
  console.log(`   Last 7 days trend: ${dashRes.data?.last7Days?.length} data points`);
  console.log('');

  // 2. Profit & Loss Report
  console.log('2. GET /reports/profit-loss?period=month');
  const pnlRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/profit-loss?period=month`);
  console.log(`   Status: ${pnlRes.status}`);
  console.log(`   Period: ${pnlRes.data?.report?.period}`);
  console.log(`   Revenue:`);
  console.log(`     Gross sales: ৳${pnlRes.data?.report?.revenue?.grossSales?.toFixed(2)}`);
  console.log(`     Returns: ৳${pnlRes.data?.report?.revenue?.returns?.toFixed(2)}`);
  console.log(`     Net revenue: ৳${pnlRes.data?.report?.revenue?.netRevenue?.toFixed(2)}`);
  console.log(`   COGS: ৳${pnlRes.data?.report?.cogs?.total?.toFixed(2)} (${pnlRes.data?.report?.cogs?.percentage?.toFixed(1)}%)`);
  console.log(`   Gross profit: ৳${pnlRes.data?.report?.grossProfit?.amount?.toFixed(2)} (margin: ${pnlRes.data?.report?.grossProfit?.margin}%)`);
  console.log(`   Expenses:`);
  console.log(`     Purchases: ৳${pnlRes.data?.report?.expenses?.purchases?.toFixed(2)}`);
  console.log(`   Cash flow:`);
  console.log(`     Received: ৳${pnlRes.data?.report?.cashFlow?.received?.toFixed(2)}`);
  console.log(`     Paid: ৳${pnlRes.data?.report?.cashFlow?.paid?.toFixed(2)}`);
  console.log(`     Net: ৳${pnlRes.data?.report?.cashFlow?.net?.toFixed(2)}`);
  console.log(`   Net profit: ৳${pnlRes.data?.report?.netProfit?.amount?.toFixed(2)} (margin: ${pnlRes.data?.report?.netProfit?.margin}%)`);
  console.log(`   Top profitable products: ${pnlRes.data?.report?.topProducts?.length}`);
  pnlRes.data?.report?.topProducts?.slice(0, 3).forEach((p) => {
    console.log(`     ${p.name}: ${p.quantity} units, profit ৳${p.profit.toFixed(2)}`);
  });
  console.log(`   Loss-making products: ${pnlRes.data?.report?.lossProducts?.length}`);
  console.log('');

  // 3. P&L CSV format
  console.log('3. GET /reports/profit-loss?format=csv');
  const pnlCsv = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/profit-loss?format=csv`, null, false);
  console.log(`   Status: ${pnlCsv.status}`);
  console.log(`   CSV starts with: ${pnlCsv.raw.split('\n')[0]}`);
  console.log(`   CSV lines: ${pnlCsv.raw.split('\n').length}`);
  console.log('');

  // 4. Inventory Valuation
  console.log('4. GET /reports/inventory-valuation');
  const invRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/inventory-valuation`);
  console.log(`   Status: ${invRes.status}`);
  console.log(`   Summary:`);
  console.log(`     Total products: ${invRes.data?.report?.summary?.totalProducts}`);
  console.log(`     Total batches: ${invRes.data?.report?.summary?.totalBatches}`);
  console.log(`     Total quantity: ${invRes.data?.report?.summary?.totalQuantity}`);
  console.log(`     Cost value: ৳${invRes.data?.report?.summary?.totalCostValue?.toFixed(2)}`);
  console.log(`     MRP value: ৳${invRes.data?.report?.summary?.totalMRPValue?.toFixed(2)}`);
  console.log(`     Potential profit: ৳${invRes.data?.report?.summary?.totalPotentialProfit?.toFixed(2)}`);
  console.log(`     Average margin: ${invRes.data?.report?.summary?.averageMargin?.toFixed(1)}%`);
  console.log(`   Categories: ${invRes.data?.report?.categories?.length}`);
  invRes.data?.report?.categories?.slice(0, 3).forEach((c) => {
    console.log(`     ${c.name}: ${c.productCount} products, cost ৳${c.costValue.toFixed(0)}, MRP ৳${c.mrpValue.toFixed(0)}`);
  });
  console.log(`   Products: ${invRes.data?.report?.products?.length}`);
  console.log('');

  // 5. Inventory Valuation CSV
  console.log('5. GET /reports/inventory-valuation?format=csv');
  const invCsv = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/inventory-valuation?format=csv`, null, false);
  console.log(`   Status: ${invCsv.status}`);
  console.log(`   CSV starts with: ${invCsv.raw.split('\n')[0]}`);
  console.log(`   CSV lines: ${invCsv.raw.split('\n').length}`);
  console.log('');

  // 6. Business Report (comprehensive)
  console.log('6. GET /reports/business?period=month');
  const bizRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/business?period=month`);
  console.log(`   Status: ${bizRes.status}`);
  console.log(`   Business: ${bizRes.data?.report?.business?.name}`);
  console.log(`   Executive summary:`);
  console.log(`     Total sales: ৳${bizRes.data?.report?.executiveSummary?.totalSales?.toFixed(2)}`);
  console.log(`     Net revenue: ৳${bizRes.data?.report?.executiveSummary?.netRevenue?.toFixed(2)}`);
  console.log(`     COGS: ৳${bizRes.data?.report?.executiveSummary?.totalCOGS?.toFixed(2)}`);
  console.log(`     Gross profit: ৳${bizRes.data?.report?.executiveSummary?.grossProfit?.toFixed(2)} (margin: ${bizRes.data?.report?.executiveSummary?.grossMargin?.toFixed(1)}%)`);
  console.log(`     Total purchases: ৳${bizRes.data?.report?.executiveSummary?.totalPurchases?.toFixed(2)}`);
  console.log(`     Cash received: ৳${bizRes.data?.report?.executiveSummary?.cashReceived?.toFixed(2)}`);
  console.log(`     Net cash flow: ৳${bizRes.data?.report?.executiveSummary?.netCashFlow?.toFixed(2)}`);
  console.log(`   Inventory: cost ৳${bizRes.data?.report?.inventory?.costValue?.toFixed(0)}, MRP ৳${bizRes.data?.report?.inventory?.mrpValue?.toFixed(0)}`);
  console.log(`   Contacts: ${bizRes.data?.report?.contacts?.totalCustomers} customers, ${bizRes.data?.report?.contacts?.totalSuppliers} suppliers`);
  console.log(`   Financials: receivables ৳${bizRes.data?.report?.financials?.receivables?.amount?.toFixed(0)}, payables ৳${bizRes.data?.report?.financials?.payables?.amount?.toFixed(0)}`);
  console.log(`   Top products: ${bizRes.data?.report?.topProducts?.length}`);
  console.log(`   Daily data points: ${bizRes.data?.report?.dailyData?.length}`);
  console.log('');

  console.log('=== All Phase 6a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
