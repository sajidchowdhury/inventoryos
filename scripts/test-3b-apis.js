// Test Phase 3b APIs: Alert Preferences, Combined Alerts, Reports, Digest, Notifications
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
  console.log('=== Phase 3b API Tests ===\n');

  // 1. Get default alert preferences (should create with defaults)
  console.log('1. GET /alert-preferences (default creation)');
  const getPRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/alert-preferences`);
  console.log(`   Status: ${getPRes.status}`);
  console.log(`   Default prefs:`);
  console.log(`     expiryCriticalDays: ${getPRes.data?.preferences?.expiryCriticalDays} (expected 7)`);
  console.log(`     expiryWarningDays: ${getPRes.data?.preferences?.expiryWarningDays} (expected 30)`);
  console.log(`     expiryNoticeDays: ${getPRes.data?.preferences?.expiryNoticeDays} (expected 90)`);
  console.log(`     lowStockThreshold: ${getPRes.data?.preferences?.lowStockThreshold} (expected 10)`);
  console.log(`     digestFrequency: ${getPRes.data?.preferences?.digestFrequency} (expected daily)`);
  console.log('');

  // 2. Update preferences with custom values
  console.log('2. PUT /alert-preferences (custom values)');
  const updatePRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/alert-preferences`, {
    expiryCriticalDays: 14,
    expiryWarningDays: 45,
    expiryNoticeDays: 120,
    lowStockThreshold: 20,
    lowStockEnabled: true,
    quarantineAlerts: true,
    emailEnabled: true,
    email: 'pharmacy@test.com',
    digestFrequency: 'weekly',
    quietHoursStart: 22,
    quietHoursEnd: 7,
  });
  console.log(`   Status: ${updatePRes.status}`);
  console.log(`   Updated prefs:`);
  console.log(`     expiryCriticalDays: ${updatePRes.data?.preferences?.expiryCriticalDays} (expected 14)`);
  console.log(`     expiryWarningDays: ${updatePRes.data?.preferences?.expiryWarningDays} (expected 45)`);
  console.log(`     expiryNoticeDays: ${updatePRes.data?.preferences?.expiryNoticeDays} (expected 120)`);
  console.log(`     email: ${updatePRes.data?.preferences?.email}`);
  console.log(`     digestFrequency: ${updatePRes.data?.preferences?.digestFrequency}`);
  console.log('');

  // 3. Test invalid threshold order (should fail)
  console.log('3. PUT /alert-preferences (invalid: critical >= warning → 400)');
  const invalidPRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/alert-preferences`, {
    expiryCriticalDays: 50,
    expiryWarningDays: 30,
    expiryNoticeDays: 90,
  });
  console.log(`   Status: ${invalidPRes.status} (expected 400)`);
  console.log(`   Error: ${invalidPRes.data?.error}`);
  console.log('');

  // Setup: Create test batches for combined alerts
  console.log('--- Setting up test batches for combined alerts ---');
  const productsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=3`);
  const products = productsRes.data?.products || [];
  const product1 = products[0];
  const product2 = products[1];

  const now = new Date();
  const tenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // Within custom 14-day critical
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Within 45-day warning
  const hundredDays = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000); // Within 120-day notice
  const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Expired

  const batch1 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product1.id, batchNo: '3B-CRIT',
    expiryDate: tenDays.toISOString().split('T')[0],
    quantity: 50, purchasePrice: 5, mrp: 50,
  });
  const batch2 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product2.id, batchNo: '3B-WARN',
    expiryDate: thirtyDays.toISOString().split('T')[0],
    quantity: 30, purchasePrice: 5, mrp: 50,
  });
  const batch3 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product1.id, batchNo: '3B-NOTICE',
    expiryDate: hundredDays.toISOString().split('T')[0],
    quantity: 40, purchasePrice: 5, mrp: 50,
  });
  const batch4 = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/batches`, {
    productId: product2.id, batchNo: '3B-EXP',
    expiryDate: pastDate.toISOString().split('T')[0],
    quantity: 20, purchasePrice: 5, mrp: 50,
  });
  console.log(`Created 4 batches: critical (10d), warning (30d), notice (100d), expired\n`);

  // 4. Test Combined Alerts
  console.log('4. GET /combined-alerts (using custom thresholds)');
  const alertsRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/combined-alerts`);
  console.log(`   Status: ${alertsRes.status}`);
  console.log(`   Summary:`);
  console.log(`     Total alerts: ${alertsRes.data?.summary?.total}`);
  console.log(`     Critical: ${alertsRes.data?.summary?.critical}`);
  console.log(`     Warning: ${alertsRes.data?.summary?.warning}`);
  console.log(`     Info: ${alertsRes.data?.summary?.info}`);
  console.log(`     By type:`, JSON.stringify(alertsRes.data?.summary?.byType, null, 4));
  console.log(`     Total value at risk: ৳${alertsRes.data?.summary?.totalValueAtRisk?.toFixed(2)}`);
  console.log(`   Preferences used:`);
  console.log(`     expiryCriticalDays: ${alertsRes.data?.preferences?.expiryCriticalDays} (expected 14)`);
  console.log(`     expiryWarningDays: ${alertsRes.data?.preferences?.expiryWarningDays} (expected 45)`);
  console.log('');

  // 5. Test Expiry Report (JSON)
  console.log('5. GET /reports/expiry?period=daily (JSON)');
  const reportRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/expiry?period=daily`);
  console.log(`   Status: ${reportRes.status}`);
  console.log(`   Report info:`);
  console.log(`     Business: ${reportRes.data?.report?.business?.name}`);
  console.log(`     Period: ${reportRes.data?.report?.period}`);
  console.log(`     Generated: ${reportRes.data?.report?.generatedAt}`);
  console.log(`   Summary:`);
  console.log(`     Total batches: ${reportRes.data?.report?.summary?.totalBatches}`);
  console.log(`     Total units: ${reportRes.data?.report?.summary?.totalUnits}`);
  console.log(`     Units at risk: ${reportRes.data?.report?.summary?.totalUnitsAtRisk}`);
  console.log(`     Value at risk: ৳${reportRes.data?.report?.summary?.totalValueAtRisk?.toFixed(2)}`);
  console.log(`     Sections:`, JSON.stringify(reportRes.data?.report?.summary?.sections, null, 4));
  console.log('');

  // 6. Test Expiry Report (CSV)
  console.log('6. GET /reports/expiry?format=csv (CSV download)');
  const csvRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/reports/expiry?format=csv`, null, false);
  console.log(`   Status: ${csvRes.status}`);
  console.log(`   Content-Type: text/csv? ${csvRes.raw.includes('Section,Product,Batch No')}`);
  console.log(`   First 2 lines:`);
  csvRes.raw.split('\n').slice(0, 4).forEach((line) => console.log(`     ${line}`));
  console.log('');

  // 7. Test Alert Digest (weekly — matches our preference)
  console.log('7. POST /alerts/digest (weekly — should match preference)');
  const digestRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/alerts/digest`, {
    period: 'weekly',
  });
  console.log(`   Status: ${digestRes.status}`);
  console.log(`   Digest:`);
  console.log(`     Business: ${digestRes.data?.digest?.businessName}`);
  console.log(`     Period: ${digestRes.data?.digest?.period}`);
  console.log(`     Summary:`, JSON.stringify(digestRes.data?.digest?.summary, null, 4));
  console.log(`     Notifications created: ${digestRes.data?.digest?.notificationsCreated}`);
  console.log(`     Delivery targets:`, JSON.stringify(digestRes.data?.digest?.deliveryTargets, null, 2));
  console.log('');

  // 8. Test Digest with mismatched frequency
  console.log('8. POST /alerts/digest (daily — should skip, preference is weekly)');
  const skipRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/alerts/digest`, {
    period: 'daily',
  });
  console.log(`   Status: ${skipRes.status}`);
  console.log(`   Skipped: ${skipRes.data?.skipped} (expected true)`);
  console.log(`   Reason: ${skipRes.data?.reason}`);
  console.log('');

  // 9. Test Notifications list
  console.log('9. GET /notifications (list notification logs)');
  const notifRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/notifications?limit=10`);
  console.log(`   Status: ${notifRes.status}`);
  console.log(`   Total notifications: ${notifRes.data?.totalCount}`);
  console.log(`   Unread count: ${notifRes.data?.unreadCount}`);
  console.log(`   Recent notifications:`);
  notifRes.data?.notifications?.slice(0, 5).forEach((n) => {
    console.log(`     [${n.severity}] ${n.title} — ${n.message?.substring(0, 60)}...`);
  });
  console.log('');

  // 10. Test Mark all notifications as read
  console.log('10. PUT /notifications (mark all as read)');
  const markRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/notifications`, {
    all: true,
  });
  console.log(`   Status: ${markRes.status}`);
  console.log(`   Marked read: ${markRes.data?.markedRead}`);
  console.log('');

  // 11. Verify unread count is now 0
  console.log('11. Verify unread count = 0');
  const notifRes2 = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/notifications?limit=10`);
  console.log(`   Unread count: ${notifRes2.data?.unreadCount} (expected 0)`);
  console.log('');

  // 12. Run digest again — should not create duplicates
  console.log('12. POST /alerts/digest (again — should dedupe)');
  const digest2Res = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/alerts/digest`, {
    period: 'weekly',
  });
  console.log(`   Status: ${digest2Res.status}`);
  console.log(`   Notifications created this time: ${digest2Res.data?.digest?.notificationsCreated} (expected 0 — deduped)`);
  console.log('');

  // 13. Test Delete old notifications
  console.log('13. DELETE /notifications?olderThanDays=0 (cleanup)');
  const delRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/notifications?olderThanDays=0`);
  console.log(`   Status: ${delRes.status}`);
  console.log(`   Deleted: ${delRes.data?.deleted}`);
  console.log('');

  // ===== CLEANUP =====
  console.log('--- Cleanup ---');
  // Reset preferences to defaults
  await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/alert-preferences`, {
    expiryCriticalDays: 7,
    expiryWarningDays: 30,
    expiryNoticeDays: 90,
    lowStockThreshold: 10,
    emailEnabled: false,
    smsEnabled: false,
    digestFrequency: 'daily',
    quietHoursStart: null,
    quietHoursEnd: null,
  });
  console.log('   Reset preferences to defaults');

  // Delete test batches
  for (const b of [batch1.data?.batch?.id, batch2.data?.batch?.id, batch3.data?.batch?.id, batch4.data?.batch?.id]) {
    if (b) await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/batches/${b}`);
  }
  console.log('   Deleted 4 test batches');

  console.log('\n=== All Phase 3b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
