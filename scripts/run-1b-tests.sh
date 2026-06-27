#!/bin/bash
# Run Phase 1b tests with server kept alive
cd /home/z/my-project
pkill -f "next" 2>/dev/null
sleep 2

# Start server in background
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js > /tmp/srv.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
for i in $(seq 1 20); do
  if ss -tlnp | grep -q ":3000 "; then
    echo "Server is listening (PID $SERVER_PID)"
    break
  fi
  sleep 0.5
done

# Run tests
node /home/z/my-project/scripts/test-1b-apis.js
TEST_EXIT=$?

# Cleanup
kill $SERVER_PID 2>/dev/null
exit $TEST_EXIT
