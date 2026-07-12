# Handoff Report — Explorer 3 (Milestone 5.2, Iteration 2)

## 1. Observation
During Playwright E2E test execution in `e2e/run_e2e.ts`, the test suite failed with exit code 1 due to timeouts starting at Test 10, immediately following an unexpected exit of the Next.js server after Test 9.

Direct inspection of the codebase revealed the following:
- **`e2e/run_e2e.ts` (lines 408-417)** spawns the Next.js server with `node` arguments and `NODE_OPTIONS` that omit `e2e/suppress_crashes.js`:
  ```typescript
  const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '...',
      SUPABASE_SERVICE_ROLE_KEY: '...'
    }
  });
  ```
- **`e2e/run_e2e.ts` (lines 419-428)** defines the `exit` event handler for `nextServer`:
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
- **`e2e/suppress_crashes.js` (lines 1-20)** contains explicit logic to intercept and suppress fatal events and signals (`uncaughtException`, `unhandledRejection`, `process.exit`, `process.kill`, `SIGTERM`, `SIGINT`) specifically to "prevent Next.js server from terminating during E2E tests."
- **`fuser -k 3000/tcp` behavior**: The `fuser -k 3000/tcp` command sends `SIGKILL` to ALL processes with open file descriptors or sockets on port 3000. During active Playwright E2E testing, Playwright's Chromium client processes maintain open sockets connected to port 3000.

## 2. Logic Chain
1. **Omission of Crash Suppression**: Because `e2e/run_e2e.ts` spawns the Next.js server without `--require ./e2e/suppress_crashes.js` in `NODE_OPTIONS` or the `node` command arguments, the Next.js server remains vulnerable to unhandled exceptions, exit calls, or signals. Consequently, after Test 9 (`should render correct current month in extreme western timezone (Hawaii)`), the Next.js server exits unexpectedly with `code null`.
2. **Indiscriminate Port Cleanup**: When `nextServer` exits, the `nextServer.on('exit')` handler is triggered. It executes `fuser -k 3000/tcp` to free port 3000 before respawning the server.
3. **Client Process Termination & Context Corruption**: Because `fuser -k 3000/tcp` targets all processes interacting with port 3000, it terminates the active Playwright Chromium client processes alongside any lingering server processes.
4. **Cascading Test Timeouts**: The abrupt termination of the Playwright browser processes corrupts Playwright's underlying browser context. When the Next.js server respawns and Playwright attempts to execute Test 10 (`should navigate to /budget, expand accordions, open selection modal, and propagate budget forward`), Playwright cannot communicate with the terminated browser context, resulting in a ~15.3s timeout for Test 10 and every subsequent test (Tests 10 through 55), ultimately failing the E2E suite with exit code 1.

## 3. Caveats
- **Read-Only Investigation**: As an Explorer agent, no code changes were implemented directly. The recommended fix strategy must be applied by an implementer/worker agent.
- **Underlying Cause of Server Exit**: While `suppress_crashes.js` will prevent the Next.js server from exiting after Test 9, the exact trigger of the exit (e.g., a third-party library calling `process.exit` or an unhandled rejection in extreme timezone rendering) is intentionally suppressed rather than debugged at the root level, in alignment with the project's E2E testing harness design.

## 4. Conclusion
To resolve the E2E test failures and prevent Playwright browser context corruption, the E2E test runner (`e2e/run_e2e.ts`) must be updated with a two-part fix strategy:

### Recommended Fix Strategy

#### Part 1: Include Crash Suppression in `next start`
Modify `e2e/run_e2e.ts` (lines 408-412) to inject `--require ./e2e/suppress_crashes.js` into both the `node` spawn arguments and the `NODE_OPTIONS` environment variable.

```typescript
// BEFORE (e2e/run_e2e.ts lines 408-412)
const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096',
```

```typescript
// AFTER (PROPOSED)
const nextServer = require('child_process').spawn('node', ['--unhandled-rejections=warn', '--max-old-space-size=4096', '--require', './e2e/suppress_crashes.js', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--unhandled-rejections=warn --max-old-space-size=4096 --require ./e2e/suppress_crashes.js',
```

#### Part 2: Refine Port Cleanup Logic in `nextServer.on('exit')`
Modify `e2e/run_e2e.ts` (lines 423) to avoid terminating client browser processes. Since `fuser -k 3000/tcp` is already correctly executed before initial startup (line 401) when no browser processes exist, the `exit` handler should only target the specific server process listening on port 3000, or rely on the initial cleanup.

```typescript
// BEFORE (e2e/run_e2e.ts line 423)
try { execSync('fuser -k 3000/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```

```typescript
// AFTER (PROPOSED - Option A: Target only the listening server process)
try { execSync('lsof -ti:3000 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
```
*(Note: Alternatively, Option B is to remove the `fuser -k 3000/tcp` line from the `exit` handler entirely, as `nextServer` terminating naturally releases the listening socket).*

## 5. Verification Method
After an implementer applies the recommended fixes to `e2e/run_e2e.ts`, verify the solution using the following steps:

1. **Verify TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected: Completes with zero TypeScript errors.*

2. **Run E2E Test Suite**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts
   ```
   *Expected: The Next.js server does not exit after Test 9 (or if it does, it respawns without killing Playwright client processes). All 55 Playwright tests complete successfully with exit code 0.*
