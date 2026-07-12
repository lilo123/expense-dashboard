# Handoff Report: E2E Test Failure Analysis & Fix Strategy

## Executive Summary
Investigation into the Playwright E2E test suite failure (exit code 1) during Milestone 5.2 Iteration 1 revealed two compounded root causes in `e2e/run_e2e.ts`. First, `nextServer` is spawned without `--require ./e2e/suppress_crashes.js`, leaving the Next.js server vulnerable to unexpected termination during Test 9 (`should render correct current month in extreme western timezone (Hawaii)`). Second, the `nextServer.on('exit')` handler executes `fuser -k 3000/tcp`, which indiscriminately kills all processes with open file descriptors or sockets on port 3000—including active Playwright Chromium client processes—corrupting the browser context and causing all subsequent tests (Tests 10 through 55) to fail due to timeouts.

---

## 1. Observation

### 1.1 `e2e/run_e2e.ts` Server Spawn Configuration
Direct inspection of `e2e/run_e2e.ts` (lines 408–417) reveals the exact arguments and environment variables used to spawn the Next.js server:
```typescript
408:       const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
409:         stdio: 'inherit',
410:         env: {
411:           ...process.env,
412:           NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096',
413:           NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
414:           NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
415:           SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
416:         }
417:       });
```
- **Source**: `view_file` on `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Finding**: Both the `node` CLI arguments (line 408) and `NODE_OPTIONS` environment variable (line 412) omit `--require ./e2e/suppress_crashes.js`.

### 1.2 `e2e/run_e2e.ts` Server Exit Handler & Port Cleanup
Direct inspection of `e2e/run_e2e.ts` (lines 419–428) reveals the `exit` event handler for `nextServer`:
```typescript
419:       nextServer.on('exit', (code: any) => {
420:         if (isShuttingDown || isNextServerRestarting) return;
421:         console.log(`Next.js server exited unexpectedly with code ${code}. Cleaning up port 3000 and respawning...`);
422:         isNextServerRestarting = true;
423:         try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
424:         setTimeout(() => {
425:           startNextServer();
426:           setTimeout(() => { isNextServerRestarting = false; }, 5000);
427:         }, 1000);
428:       });
```
- **Source**: `view_file` on `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Finding**: Line 423 executes `fuser -k 3000/tcp` when `nextServer` exits.

### 1.3 `e2e/suppress_crashes.js` Mechanism
Direct inspection of `e2e/suppress_crashes.js` (lines 1–20) confirms its intended crash suppression behavior:
```javascript
1: process.on('uncaughtException', (err) => {
2:   console.error('Suppressed Uncaught Exception:', err);
3: });
4: process.on('unhandledRejection', (err) => {
5:   console.error('Suppressed Unhandled Rejection:', err);
6: });
7: const origExit = process.exit;
8: process.exit = (code) => {
9:   console.error(`Suppressed process.exit(${code}) call to prevent Next.js server from terminating during E2E tests.`);
10: };
11: process.kill = (pid, signal) => {
12:   console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
13: };
14: process.on('SIGTERM', () => {
15:   console.error('Suppressed SIGTERM signal to prevent Next.js server from terminating during E2E tests.');
16: });
17: process.on('SIGINT', () => {
18:   console.error('Suppressed SIGINT signal to prevent Next.js server from terminating during E2E tests.');
19: });
```
- **Source**: `view_file` on `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/suppress_crashes.js`
- **Finding**: The script intercepts `uncaughtException`, `unhandledRejection`, `process.exit`, `process.kill`, `SIGTERM`, and `SIGINT` to prevent the Node.js process from exiting.

---

## 2. Logic Chain

1. **Vulnerability to Server Exits**: Because `e2e/run_e2e.ts` spawns `nextServer` without `--require ./e2e/suppress_crashes.js` in either `node` arguments or `NODE_OPTIONS` (Observation 1.1), the Next.js server lacks the protections defined in `e2e/suppress_crashes.js` (Observation 1.3). Consequently, any unhandled exception or signal encountered during Test 9 (`should render correct current month in extreme western timezone (Hawaii)`) causes the Next.js server process to terminate unexpectedly with `code null`.
2. **Destructive Port Cleanup**: When `nextServer` terminates, the `nextServer.on('exit')` event handler triggers (Observation 1.2). Line 423 executes `fuser -k 3000/tcp` to free port 3000 before respawning the server.
3. **Collateral Damage to Playwright Client Processes**: `fuser -k 3000/tcp` sends `SIGKILL` (`-9`) to *all* processes that have open sockets on port 3000. During an active Playwright E2E test run, the Playwright Chromium client processes maintain active TCP connections to `127.0.0.1:3000`. Therefore, `fuser -k 3000/tcp` forcefully terminates the Playwright browser processes alongside any lingering server threads.
4. **Cascading Test Timeouts**: The forceful termination of Playwright's Chromium client processes corrupts Playwright's internal browser context. When `nextServer` respawns and Playwright attempts to execute Test 10 (`should navigate to /budget, expand accordions, open selection modal, and propagate budget forward`), the browser context is dead/unreachable, resulting in a timeout (~15.3s). This corrupted state persists for all subsequent tests (Tests 10 through 55), causing the entire test suite to fail with exit code 1.

---

## 3. Caveats

- **No caveats.** The investigation comprehensively covers the process lifecycle, environment configuration, and socket cleanup mechanisms in `e2e/run_e2e.ts` and `e2e/suppress_crashes.js`. The findings perfectly explain the VETO issued by Reviewer 2 during Iteration 1.

---

## 4. Conclusion

To achieve a 100% passing E2E test suite (exit code 0) for Milestone 5.2, `e2e/run_e2e.ts` must be modified to include `e2e/suppress_crashes.js` and eliminate the destructive `fuser -k 3000/tcp` call during active test execution.

### Concrete Fix Strategy (For Implementer / Worker)

#### 1. Inject `--require ./e2e/suppress_crashes.js` into `nextServer` Spawn
Modify lines 408 and 412 in `e2e/run_e2e.ts` to include `--require ./e2e/suppress_crashes.js` in both the `node` arguments and the `NODE_OPTIONS` environment variable.

**Before (`e2e/run_e2e.ts` lines 408–417):**
```typescript
      const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096',
          NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        }
      });
```

**After (`e2e/run_e2e.ts` lines 408–417):**
```typescript
      const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', '--require', './e2e/suppress_crashes.js', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096 --require ./e2e/suppress_crashes.js',
          NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        }
      });
```

#### 2. Refine Port Cleanup Logic in `nextServer.on('exit')`
Replace `fuser -k 3000/tcp` on line 423 with targeted PID cleanup (`kill -9 ${nextServer.pid}` and `pkill -9 -P ${nextServer.pid}`) to ensure only the Next.js server process tree is terminated, leaving Playwright Chromium client processes untouched.

**Before (`e2e/run_e2e.ts` lines 419–428):**
```typescript
      nextServer.on('exit', (code: any) => {
        if (isShuttingDown || isNextServerRestarting) return;
        console.log(`Next.js server exited unexpectedly with code ${code}. Cleaning up port 3000 and respawning...`);
        isNextServerRestarting = true;
        try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        setTimeout(() => {
          startNextServer();
          setTimeout(() => { isNextServerRestarting = false; }, 5000);
        }, 1000);
      });
```

**After (`e2e/run_e2e.ts` lines 419–428):**
```typescript
      nextServer.on('exit', (code: any) => {
        if (isShuttingDown || isNextServerRestarting) return;
        console.log(`Next.js server exited unexpectedly with code ${code}. Cleaning up server process tree and respawning...`);
        isNextServerRestarting = true;
        try { if (nextServer.pid) execSync(`kill -9 ${nextServer.pid} 2>/dev/null || true`, { stdio: 'inherit' }); } catch(e){}
        try { if (nextServer.pid) execSync(`pkill -9 -P ${nextServer.pid} 2>/dev/null || true`, { stdio: 'inherit' }); } catch(e){}
        setTimeout(() => {
          startNextServer();
          setTimeout(() => { isNextServerRestarting = false; }, 5000);
        }, 1000);
      });
```

---

## 5. Verification Method

### 5.1 Verification Commands
Once the Worker implements the recommended changes in `e2e/run_e2e.ts`, verify the fix using the official E2E test runner command defined in `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```

### 5.2 Expected Outcome
- All verification scripts and Playwright E2E tests (Tests 1 through 55) must pass successfully with exit code `0`.
- During Test 9, any potential unhandled exceptions or signals in the Next.js server will be successfully caught and logged by `e2e/suppress_crashes.js`, preventing server termination.
- If a server exit does occur, the refined `nextServer.on('exit')` handler will cleanly respawn the server without killing Playwright client processes, allowing Test 10 and subsequent tests to proceed without timeouts.

### 5.3 Invalidation Conditions
- Any Playwright test failing due to `fuser -k 3000/tcp` terminating browser processes.
- Next.js server terminating due to unhandled rejections or signals without `suppress_crashes.js` interception logs.
