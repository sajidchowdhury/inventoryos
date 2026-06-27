// Test Phase 7a APIs: Users CRUD, Roles, Permissions
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
  console.log('=== Phase 7a API Tests ===\n');

  // 1. Get roles
  console.log('1. GET /roles');
  const rolesRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/roles`);
  console.log(`   Status: ${rolesRes.status}`);
  console.log(`   Roles: ${rolesRes.data?.roles?.length}`);
  rolesRes.data?.roles?.forEach((r) => {
    console.log(`     ${r.label} (${r.name}): ${r.permissions.length} permissions — ${r.description}`);
  });
  console.log(`   All permissions: ${rolesRes.data?.allPermissions?.length}`);
  console.log('');

  // 2. List users
  console.log('2. GET /users (list)');
  const listRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/users`);
  console.log(`   Status: ${listRes.status}`);
  console.log(`   Total users: ${listRes.data?.users?.length}`);
  listRes.data?.users?.forEach((u) => {
    console.log(`     @${u.username} — ${u.role} — ${u.isActive ? 'active' : 'inactive'}`);
  });
  console.log('');

  // 3. Create a pharmacist user
  console.log('3. POST /users (create pharmacist)');
  const createRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users`, {
    username: 'pharmacist1',
    password: '1234',
    fullName: 'Dr. Sarah Ahmed',
    role: 'pharmacist',
    phone: '01788889999',
    email: 'sarah@pharmacy.com',
  });
  console.log(`   Status: ${createRes.status}`);
  console.log(`   User: ${createRes.data?.user?.username} (${createRes.data?.user?.role})`);
  console.log(`   Full name: ${createRes.data?.user?.fullName}`);
  console.log(`   Effective permissions: ${createRes.data?.effectivePermissions?.length} permissions`);
  const newUserId = createRes.data?.user?.id;
  console.log('');

  // 4. Duplicate username
  console.log('4. POST /users (duplicate username → 409)');
  const dupRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users`, {
    username: 'pharmacist1',
    password: '1234',
    role: 'pharmacist',
  });
  console.log(`   Status: ${dupRes.status} (expected 409)`);
  console.log(`   Error: ${dupRes.data?.error}`);
  console.log('');

  // 5. Get individual user
  console.log('5. GET /users/[id] (individual)');
  const getRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/users/${newUserId}`);
  console.log(`   Status: ${getRes.status}`);
  console.log(`   Username: ${getRes.data?.user?.username}`);
  console.log(`   Role: ${getRes.data?.user?.role}`);
  console.log(`   Effective permissions: ${getRes.data?.effectivePermissions?.length} permissions`);
  console.log(`   Has "dispense.create": ${getRes.data?.effectivePermissions?.includes('dispense.create')}`);
  console.log(`   Has "users.create": ${getRes.data?.effectivePermissions?.includes('users.create')} (expected false for pharmacist)`);
  console.log('');

  // 6. Create a cashier user
  console.log('6. POST /users (create cashier)');
  const cashierRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/users`, {
    username: 'cashier1',
    password: '1234',
    fullName: 'Mr. Karim',
    role: 'cashier',
  });
  console.log(`   Status: ${cashierRes.status}`);
  console.log(`   User: ${cashierRes.data?.user?.username} (${cashierRes.data?.user?.role})`);
  console.log(`   Permissions: ${cashierRes.data?.effectivePermissions?.length}`);
  console.log(`   Has "sales.create": ${cashierRes.data?.effectivePermissions?.includes('sales.create')}`);
  console.log(`   Has "purchases.create": ${cashierRes.data?.effectivePermissions?.includes('purchases.create')} (expected false)`);
  const cashierId = cashierRes.data?.user?.id;
  console.log('');

  // 7. Update user (change role + password)
  console.log('7. PUT /users/[id] (change role to manager)');
  const updateRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/users/${newUserId}`, {
    role: 'manager',
    fullName: 'Dr. Sarah Ahmed (Manager)',
    password: 'newpass123',
  });
  console.log(`   Status: ${updateRes.status}`);
  console.log(`   Updated role: ${updateRes.data?.user?.role} (expected manager)`);
  console.log(`   Updated name: ${updateRes.data?.user?.fullName}`);
  console.log(`   New permissions: ${updateRes.data?.effectivePermissions?.length} (should be more than pharmacist)`);
  console.log(`   Now has "purchases.create": ${updateRes.data?.effectivePermissions?.includes('purchases.create')} (expected true)`);
  console.log('');

  // 8. Get permissions for current user
  console.log('8. GET /permissions (current user)');
  const permRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/permissions`);
  console.log(`   Status: ${permRes.status}`);
  console.log(`   Current user: ${permRes.data?.currentUser?.username} (${permRes.data?.currentUser?.role})`);
  console.log(`   Permissions: ${permRes.data?.permissions?.length}`);
  console.log(`   Role config: ${permRes.data?.roleConfig?.label}`);
  console.log('');

  // 9. Try to delete the last admin (should fail)
  console.log('9. DELETE /users/[id] (try to delete admin — should succeed since there are 2 admins)');
  const adminUser = listRes.data?.users?.find((u) => u.role === 'admin' && u.isActive);
  if (adminUser) {
    const delRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/users/${adminUser.id}`);
    console.log(`   Status: ${delRes.status}`);
    console.log(`   Message: ${delRes.data?.message || delRes.data?.error}`);
  }
  console.log('');

  // 10. Deactivate cashier
  console.log('10. DELETE /users/[id] (deactivate cashier)');
  const delCashier = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/users/${cashierId}`);
  console.log(`   Status: ${delCashier.status}`);
  console.log(`   Message: ${delCashier.data?.message}`);
  console.log('');

  // 11. Verify user list after changes
  console.log('11. GET /users (verify after changes)');
  const finalList = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/users`);
  console.log(`   Status: ${finalList.status}`);
  console.log(`   Total users: ${finalList.data?.users?.length}`);
  finalList.data?.users?.forEach((u) => {
    console.log(`     @${u.username} — ${u.role} — ${u.isActive ? 'active' : 'inactive'}`);
  });
  console.log('');

  // ── CLEANUP ──
  console.log('--- Cleanup ---');
  // Reactivate the admin we deactivated
  if (adminUser) {
    await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/users/${adminUser.id}`, { isActive: true });
    console.log('   Reactivated admin user');
  }
  // Delete test users
  await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/users/${newUserId}`, { isActive: true });
  await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/users/${newUserId}`);
  console.log('   Cleaned up test users');

  console.log('\n=== All Phase 7a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
