// Test Phase 1b APIs: CSV import, category CRUD, template download
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
  console.log('=== Phase 1b API Tests ===\n');

  // 1. Test CSV template download
  console.log('1. GET /api/businesses/[id]/products/template');
  const templateRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products/template`, null, false);
  console.log(`   Status: ${templateRes.status}`);
  console.log(`   Content-Type: text/csv? ${templateRes.raw.includes('name,genericName,strength')}`);
  const templateLines = templateRes.raw.split('\n');
  console.log(`   Header row: ${templateLines[0]}`);
  console.log(`   Sample row 1: ${templateLines[1]}`);
  console.log(`   Total lines: ${templateLines.length}\n`);

  // 2. Test category PUT (edit an existing category)
  console.log('2. PUT /api/businesses/[id]/categories/[categoryId] (rename "Eye & Ear" to "Eye, Ear & Dental")');
  const catId = 'cmqw95pua000ovozrwg7m2www'; // Eye & Ear category
  const editRes = await makeRequest('PUT', `/api/businesses/${BUSINESS_ID}/categories/${catId}`, {
    name: 'Eye, Ear & Dental',
    color: '#6366F1',
    icon: 'Eye',
    type: 'medicine',
    sortOrder: 9,
  });
  console.log(`   Status: ${editRes.status}`);
  console.log(`   Success: ${editRes.data?.success}`);
  console.log(`   Updated name: ${editRes.data?.category?.name}\n`);

  // 3. Test category DELETE with products (should fail safely)
  console.log('3. DELETE category that has products (should be blocked)');
  const catWithProducts = 'cmqw95pu2000avozrl60uy7rx'; // Pain & Fever (has Napa Extra)
  const delFailRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/categories/${catWithProducts}`);
  console.log(`   Status: ${delFailRes.status} (expected 400)`);
  console.log(`   Error: ${delFailRes.data?.error}\n`);

  // 4. Test category DELETE on empty category (should succeed)
  console.log('4. DELETE empty category (should succeed)');
  // First create a temporary category to delete
  const tempCat = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/categories`, {
    name: 'Test Temp Category',
    color: '#999999',
    type: 'other',
    sortOrder: 99,
  });
  console.log(`   Created temp category: ${tempCat.data?.category?.id}`);
  const delSuccessRes = await makeRequest('DELETE', `/api/businesses/${BUSINESS_ID}/categories/${tempCat.data?.category?.id}`);
  console.log(`   Status: ${delSuccessRes.status} (expected 200)`);
  console.log(`   Success: ${delSuccessRes.data?.success}\n`);

  // 5. Test CSV import with JSON payload
  console.log('5. POST /api/businesses/[id]/products/import (JSON payload)');
  const importPayload = {
    products: [
      { name: 'Ace Plus', genericName: 'Paracetamol + Caffeine', strength: '500mg+65mg', dosageForm: 'Tablet', manufacturer: 'Square', scheduleType: 'OTC', mrp: 55, categoryName: 'Pain & Fever', unit: 'tablet', isPrescription: false, minStock: 100, maxStock: 1000 },
      { name: 'Fexo', genericName: 'Fexofenadine', strength: '120mg', dosageForm: 'Tablet', manufacturer: 'Square', scheduleType: 'Schedule_H', mrp: 70, categoryName: 'Cold & Flu', unit: 'tablet', isPrescription: false, minStock: 50, maxStock: 500 },
      { name: 'Monas', genericName: 'Montelukast', strength: '10mg', dosageForm: 'Tablet', manufacturer: 'Beximco', scheduleType: 'Schedule_H', mrp: 200, categoryName: 'Respiratory', unit: 'tablet', isPrescription: true, minStock: 30, maxStock: 300 },
    ],
  };
  const importRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/import`, importPayload);
  console.log(`   Status: ${importRes.status}`);
  console.log(`   Summary:`, importRes.data?.summary);
  console.log(`   Results:`);
  importRes.data?.results?.forEach((r) => {
    console.log(`     Row ${r.row}: ${r.status} - ${r.data.name} - ${r.message}`);
  });
  console.log('');

  // 6. Test CSV import with raw CSV text
  console.log('6. POST /api/businesses/[id]/products/import (raw CSV)');
  const csvText = `name,genericName,strength,dosageForm,manufacturer,scheduleType,mrp,categoryName,unit,isPrescription,rackNo
Ventolin,Salbutamol,100mcg,Inhaler,GSK,OTC,350,Respiratory,piece,No,D5
Losec,Omeprazole,20mg,Capsule,AstraZeneca,Schedule_H,120,Digestive Health,capsule,Yes,B3
Entericin,Bismuth Subsalicylate,262mg,Tablet,OTC,OTC,40,Digestive Health,tablet,No,B4`;
  const csvRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/products/import`, csvText, false);
  console.log(`   Status: ${csvRes.status}`);
  console.log(`   Summary:`, csvRes.data?.summary);
  console.log('');

  // 7. Verify all imported products appear in product list
  console.log('7. GET /api/businesses/[id]/products (verify total count)');
  const listRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/products?limit=20`);
  console.log(`   Status: ${listRes.status}`);
  console.log(`   Total products: ${listRes.data?.pagination?.total}`);
  console.log(`   Products:`);
  listRes.data?.products?.forEach((p) => {
    console.log(`     - ${p.name} (${p.genericName || 'no generic'}) - ${p.category?.name || 'uncategorized'} - ৳${p.mrp || 0}`);
  });

  console.log('\n=== All Phase 1b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
