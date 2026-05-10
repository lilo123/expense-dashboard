#!/bin/bash
export PATH="/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH"
cd /usr/local/google/home/duynguyenn/expense-dashboard
NEXT_TELEMETRY_DISABLED=1 npm run dev > next_dev_server.log 2>&1 &
echo $! > next_dev_server.pid
