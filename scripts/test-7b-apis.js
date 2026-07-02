// Test Phase 7b APIs: Sessions, Password Change, Login Activity
import http from 'http';

const BUSINESS_ID = 'cmqw75ln30003vo9ahyhrs0lj';
const HOST = 'localhost';
const PORT = 3000;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {};
    const req = http.request({ hostname: HOST, port: PORT, path, method, headers }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch (e) { resolve({ status: res.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Phase 7b API Tests ===\n');

  // 1. Login (should return permissions + update lastLoginAt)
  console.log('1. POST /api/auth/login (verify permissions in response)');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    businessId: BUSINESS_ID,
    username: 'admin',
    password: '1234',
  });
  console.log(`   Status: ${loginRes.status}`);
  console.log(`   User: ${loginRes.data?.user?.username} (${loginRes.data?.user?.role})`);
  console.log(`   Full name: ${loginRes.data?.user?.fullName || 'null'}`);
  console.log(`   Permissions: ${loginRes.data?.permissions?.length} permissions`);
  console.log(`   Has "users.create": ${loginRes.data?.permissions?.includes('users.create')}`);
  console.log(`   Has "dispense.create": ${loginRes.data?.permissions?.includes('dispense.create')}`);
  const sessionToken = loginRes.data?.session?.token;
  console.log('');

  // 2. Get active sessions
  console.log('2. GET /sessions (active sessions)');
  const sessRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/sessions`);
  console.log(`   Status: ${sessRes.status}`);
  console.log(`   Active sessions: ${sessRes.data?.count}`);
  sessRes.data?.sessions?.forEach((s) => {
    console.log(`     ${s.username} — ${s.deviceInfo?.substring(0, 30)}... — active: ${s.isActive}`);
  });
  const sessionId = sessRes.data?.sessions?.[0]?.id;
  console.log('');

  // 3. Get login activity
  console.log('3. GET /login-activity');
  const activityRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/login-activity`);
  console.log(`   Status: ${activityRes.status}`);
  console.log(`   Summary:`);
  console.log(`     Total users: ${activityRes.data?.summary?.totalUsers}`);
  console.log(`     Active users: ${activityRes.data?.summary?.activeUsers}`);
  console.log(`     Never logged in: ${activityRes.data?.summary?.neverLoggedIn}`);
  console.log(`     Logins today: ${activityRes.data?.summary?.loginsToday}`);
  console.log(`     Logins this week: ${activityRes.data?.summary?.loginsThisWeek}`);
  console.log(`     Active sessions: ${activityRes.data?.summary?.activeSessions}`);
  console.log(`   Recent logins: ${activityRes.data?.recentLogins?.length}`);
  console.log(`   User login status:`);
  activityRes.data?.userLoginStatus?.forEach((u) => {
    console.log(`     @${u.username} — last login: ${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'} — ${u.daysSinceLogin !== null ? u.daysSinceLogin + 'd ago' : 'N/A'}`);
  });
  console.log('');

  // 4. Create a test user for password change
  console.log('4. Create test user for password change');
  const testUser = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users`, {
    username: 'testpw7b',
    password: 'oldpass',
    role: 'cashier',
    fullName: 'Test Password User',
  });
  const testUserId = testUser.data?.user?.id;
  console.log(`   Created: ${testUser.data?.user?.username} (${testUserId?.slice(-6)})`);
  console.log('');

  // 5. Change password (admin changing for another user — no current password needed)
  console.log('5. POST /users/[id]/password (admin changes password)');
  const pwRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users/${testUserId}/password`, {
    newPassword: 'newpass123',
  });
  console.log(`   Status: ${pwRes.status}`);
  console.log(`   Message: ${pwRes.data?.message}`);
  console.log('');

  // 6. Verify new password works
  console.log('6. Login with new password');
  const newLogin = await makeRequest('POST', '/api/auth/login', {
    businessId: BUSINESS_ID,
    username: 'testpw7b',
    password: 'newpass123',
  });
  console.log(`   Status: ${newLogin.status} (expected 200)`);
  console.log(`   Success: ${newLogin.data?.success}`);
  console.log('');

  // 7. Verify old password fails
  console.log('7. Login with old password (should fail)');
  const oldLogin = await makeRequest('POST', '/api/auth/login', {
    businessId: BUSINESS_ID,
    username: 'testpw7b',
    password: 'oldpass',
  });
  console.log(`   Status: ${oldLogin.status} (expected 401)`);
  console.log(`   Error: ${oldLogin.data?.error}`);
  console.log('');

  // 8. Change password with current password verification
  console.log('8. POST /users/[id]/password (with currentPassword verification)');
  const pwWithCurrent = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users/${testUserId}/password`, {
    currentPassword: 'newpass123',
    newPassword: 'finalpass456',
    invalidateOtherSessions: true,
  });
  console.log(`   Status: ${pwWithCurrent.status}`);
  console.log(`   Message: ${pwWithCurrent.data?.message}`);
  console.log('');

  // 9. Wrong current password
  console.log('9. POST /users/[id]/password (wrong current password → 400)');
  const wrongPw = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users/${testUserId}/password`, {
    currentPassword: 'wrongpassword',
    newPassword: 'shouldfail',
  });
  console.log(`   Status: ${wrongPw.status} (expected 400)`);
  console.log(`   Error: ${wrongPw.data?.error}`);
  console.log('');

  // 10. Short password
  console.log('10. POST /users/[id]/password (short password → 400)');
  const shortPw = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users/${testUserId}/password`, {
    newPassword: 'ab',
  });
  console.log(`   Status: ${shortPw.status} (expected 400)`);
  console.log(`   Error: ${shortPw.data?.error}`);
  console.log('');

  // 11. Get permissions for current user
  console.log('11. GET /permissions (current user permissions)');
  const permRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/permissions`);
  console.log(`   Status: ${permRes.status}`);
  console.log(`   Current user: ${permRes.data?.currentUser?.username} (${permRes.data?.currentUser?.role})`);
  console.log(`   Permissions: ${permRes.data?.permissions?.length}`);
  console.log(`   Role: ${permRes.data?.roleConfig?.label}`);
  console.log('');

  // 12. Revoke a session
  console.log('12. DELETE /sessions?sessionId=X (revoke session)');
  if (sessionId) {
    const revokeRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/sessions?sessionId=${sessionId}`);
    console.log(`   Status: ${revokeRes.status}`);
    console.log(`   Message: ${revokeRes.data?.message}`);
  }
  console.log('');

  // ── CLEANUP ──
  console.log('--- Cleanup ---');
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/users/${testUserId}`);
  console.log('   Deleted test user');

  console.log('\n=== All Phase 7b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
