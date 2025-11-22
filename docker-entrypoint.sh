#!/bin/sh
set -e

echo "Starting Playwright Server..."

# Start Xvfb in the background
# -screen 0 1920x1080x24: Screen 0 with 1920x1080 resolution and 24-bit color depth
# -nolisten tcp: Disable TCP connections for security (Unix sockets only)
# -noreset: Don't reset after last client exits
echo "Starting Xvfb virtual display on :99..."
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -noreset > /tmp/xvfb.log 2>&1 &
XVFB_PID=$!

# Set DISPLAY environment variable
export DISPLAY=:99

# Wait for Xvfb to start and verify it's running
echo "Waiting for Xvfb to initialize..."
sleep 2

# Check if Xvfb is still running
if ! kill -0 $XVFB_PID 2>/dev/null; then
    echo "ERROR: Xvfb failed to start. Check /tmp/xvfb.log for details:"
    cat /tmp/xvfb.log 2>/dev/null || echo "No log file found"
    exit 1
fi

echo "Xvfb started successfully (PID: $XVFB_PID)"

# Trap signals and clean up Xvfb on exit
cleanup() {
    echo "Shutting down gracefully..."
    if [ -n "$NODE_PID" ]; then
        echo "Stopping Node.js (PID: $NODE_PID)..."
        kill -TERM $NODE_PID 2>/dev/null || true
        wait $NODE_PID 2>/dev/null || true
    fi
    if [ -n "$XVFB_PID" ]; then
        echo "Stopping Xvfb (PID: $XVFB_PID)..."
        kill $XVFB_PID 2>/dev/null || true
    fi
    echo "Shutdown complete"
    exit 0
}
trap cleanup INT TERM

# Start Node.js application
echo "Starting Node.js application..."
node dist/server.js &
NODE_PID=$!

echo "Node.js started (PID: $NODE_PID)"

# Wait for Node.js to exit
wait $NODE_PID
NODE_EXIT=$?

echo "Node.js exited with code: $NODE_EXIT"

# Clean up Xvfb
kill $XVFB_PID 2>/dev/null || true

exit $NODE_EXIT
