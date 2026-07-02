#!/bin/bash
# Start Next.js production server and keep it alive
cd /home/z/my-project
PORT=3000 node .next/standalone/server.js &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
for i in $(seq 1 30); do
  if ss -tlnp | grep -q ":3000 "; then
    echo "Server is listening on port 3000"
    break
  fi
  sleep 1
done

# Test API endpoints
echo "=== Testing API endpoints ==="

echo "--- Products API ---"
node -e "
const http = require('http');
http.get('http://localhost:3000/api/businesses/cmqw75ln30003vo9ahyhrs0lj/products?limit=2', (res) => {
  let b=''; res.on('data',c=>{b+=c}); res.on('end',()=>{
    try { const d=JSON.parse(b); console.log('Success:', d.success, 'Total:', d.pagination?.total); }
    catch(e) { console.log('Parse error, raw:', b.substring(0,200)); }
  });
}).on('error', e=>console.error('Products ERR:', e.message));
"

sleep 2

echo "--- Categories API ---"
node -e "
const http = require('http');
http.get('http://localhost:3000/api/businesses/cmqw75ln30003vo9ahyhrs0lj/categories', (res) => {
  let b=''; res.on('data',c=>{b+=c}); res.on('end',()=>{
    try { const d=JSON.parse(b); console.log('Success:', d.success, 'Categories:', d.allCategories?.length); }
    catch(e) { console.log('Parse error, raw:', b.substring(0,200)); }
  });
}).on('error', e=>console.error('Categories ERR:', e.message));
"

sleep 2

echo "--- Create Product ---"
node -e "
const http = require('http');
const data = JSON.stringify({name:'Napa Extra',genericName:'Paracetamol 500mg',strength:'500mg',dosageForm:'Tablet',manufacturer:'Square',scheduleType:'OTC',mrp:50,categoryId:'cmqw95pu2000avozrl60uy7rx',unit:'tablet',isPrescription:false,minStock:50,maxStock:500,reorderLevel:100});
const req = http.request({hostname:'localhost',port:3000,path:'/api/businesses/cmqw75ln30003vo9ahyhrs0lj/products',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},(res)=>{let b='';res.on('data',c=>{b+=c});res.on('end',()=>{try{const d=JSON.parse(b);console.log('Created:',d.success,d.product?.name,d.product?.id)}catch(e){console.log('Parse error:',b.substring(0,200))}})});
req.on('error',e=>console.error('Create ERR:',e.message));
req.write(data);
req.end();
"

sleep 2

echo "=== API Tests Complete ==="
echo "Server still running: $(ss -tlnp | grep :3000 | wc -l) listeners"
