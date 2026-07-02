#!/bin/bash
# Persistent server runner with auto-restart on crash
cd /home/z/my-project
chmod 666 db/custom.db 2>/dev/null

# Kill any existing instances
pkill -f "next-server" 2>/dev/null
pkill -f "standalone/server" 2>/dev/null
pkill -f "keep-alive" 2>/dev/null
sleep 2

# Start keep-alive watcher (independent process)
nohup bash -c '
while true; do
  node -e "require(\"http\").get(\"http://localhost:3000/api/businesses/cmqw75ln30003vo9ahyhrs0lj/categories\",r=>{r.resume()}).on(\"error\",()=>{});" 2>/dev/null
  sleep 15
done
' > /tmp/keepalive.log 2>&1 &
echo "Keep-alive watcher: PID $!"

# Start production server with auto-restart
(
  while true; do
    HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js > /tmp/nextprod.log 2>&1
    echo "[$(date)] Server exited, restarting in 3s..." >> /tmp/nextprod.log
    sleep 3
  done
) &
SERVER_WRAPPER_PID=$!
echo "Server wrapper PID: $SERVER_WRAPPER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  if ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "✓ Server is listening on port 3000"
    break
  fi
  sleep 0.5
done

# Quick verification
sleep 2
node -e "
const http = require('http');
http.get('http://localhost:3000/api/businesses/cmqw75ln30003vo9ahyhrs0lj/categories', (res) => {
  let b=''; res.on('data', c => b+=c);
  res.on('end', () => {
    try { const d = JSON.parse(b); console.log('✓ Verification: ' + d.allCategories?.length + ' categories returned'); }
    catch(e) { console.log('Response:', b.substring(0,200)); }
  });
}).on('error', e => console.log('✗ Error:', e.message));
"
