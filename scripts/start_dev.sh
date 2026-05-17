#!/bin/bash
# Navigate dynamically to the project root directory relative to this script's path
cd "$(dirname "$0")/.."

NEXT_TELEMETRY_DISABLED=1 npm run dev > next_dev_server.log 2>&1 &
echo $! > next_dev_server.pid
