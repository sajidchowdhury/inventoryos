#!/bin/bash
cd /home/z/my-project
pkill -f "next" 2>/dev/null
sleep 2
chmod 666 db/custom.db 2>/dev/null

# Rebuild with latest changes
npx next build 2>&1 | tail -3

HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js > /tmp/srv.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 20); do
  if ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "Server is listening (PID $SERVER_PID)"
    break
  fi
  sleep 0.5
done

node /home/z/my-project/scripts/test-5b-apis.js
TEST_EXIT=$?

kill $SERVER_PID 2>/dev/null
exit $TEST_EXIT
