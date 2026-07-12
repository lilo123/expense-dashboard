# Handoff Report — Milestone 5.2 (Tier 2 E2E Test Pass), Iteration 3

**Task**: Investigate E2E test failures caused by `process.kill` monkey-patching in `e2e/suppress_crashes.js` and recommend a concrete fix strategy including `signal === 0` passthrough and a robust server health gating check in `e2e/run_e2e.ts`.
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

- **File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/suppress_crashes.js`, lines 11-13:
  ```javascript
  process.kill = (pid, signal) => {
    console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
  };
  ```
- **File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`, lines 441-456:
  ```typescript
  console.log('Allowing Next.js and Supabase services 10 seconds to fully stabilize...');
  for (let w = 0; w < 5; w++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try { await fetch('http://127.0.0.1:3000/login'); } catch(e){}
  }
  console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
  await new Promise((resolve, reject) => {
    const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit' });
    pw.on('close', (code: number) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Playwright tests failed with exit code ${code}`));
      }
    });
  });
  ```
- **Verbatim Error (from Reviewer 2 Iteration 2 Feedback)**:
  `Next.js server exited unexpectedly with code null` followed by cascading 30-second test timeouts across all 55 E2E tests.
- **Project Context**:
  - `PROJECT.md` and `SCOPE.md` establish the goal of achieving 100% passing Tier 2 E2E tests (Boundary & Corner Cases) with exit code 0.
  - `TEST_READY.md` specifies the test runner command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`.

---

## 2. Logic Chain

1. **Liveness Check Suppression**: Next.js 16 operates a master-worker process architecture where the master process periodically verifies the health and existence of its worker child processes using `process.kill(pid, 0)`. In Node.js, `process.kill(pid, 0)` is a non-destructive liveness check that returns `true` if the process exists and throws `ESRCH` if it does not.
2. **Unconditional Monkey-Patching**: Because `e2e/suppress_crashes.js` unconditionally intercepts `process.kill(pid, signal)` without inspecting `signal`, `process.kill(pid, 0)` calls fail to execute their native behavior.
3. **Master Process Termination**: Consequently, during the 10-second stabilization window in `e2e/run_e2e.ts`, the Next.js master process incorrectly concludes that its worker child process is dead. This triggers an unexpected shutdown of the Next.js server (`Next.js server exited unexpectedly with code null`).
4. **Silent Failure in Stabilization Loop**: In `e2e/run_e2e.ts` (lines 441-445), the stabilization loop performs `try { await fetch('http://127.0.0.1:3000/login'); } catch(e){}` but silently discards any errors when the fetch fails due to the server terminating.
5. **Unfenced Playwright Launch**: Immediately following the stabilization loop (line 447), `run_e2e.ts` spawns Playwright without verifying if the Next.js server is still active and healthy. Playwright attempts to execute the E2E test suite against an uninitialized/dead server on port 3000, resulting in cascading 30-second timeouts across all 55 E2E tests.

---

## 3. Caveats

- **Read-Only Scope**: As an Explorer agent, no code changes were directly executed or tested in this turn. The recommended changes must be implemented by the Worker agent.
- **Port 3000 Binding**: It is assumed that Worker 2's non-destructive port cleanup (`lsof -ti:3000 -sTCP:LISTEN | xargs kill -9`) remains active and effective at preventing address binding conflicts (`EADDRINUSE`).

---

## 4. Conclusion

To resolve the VETO issued by Reviewer 2 and achieve a successful Tier 2 E2E test pass, Worker 2 must implement two surgical modifications:
1. **`e2e/suppress_crashes.js`**: Store the original `process.kill` reference and allow `signal === 0` calls to pass through to `origKill(pid, signal)`.
2. **`e2e/run_e2e.ts`**: Insert a robust server health gating check immediately after the 10-second stabilization window and before spawning Playwright, ensuring Playwright never launches against a dead server.

### Proposed Code Modifications for Worker 2

#### 1. `e2e/suppress_crashes.js`
**Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/suppress_crashes.js`
**Lines**: 11-13
```javascript
// BEFORE
process.kill = (pid, signal) => {
  console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
};

// AFTER
const origKill = process.kill;
process.kill = (pid, signal) => {
  if (signal === 0) {
    return origKill(pid, signal);
  }
  console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
};
```

#### 2. `e2e/run_e2e.ts`
**Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
**Lines**: 446-447
```typescript
// BEFORE
    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    await new Promise((resolve, reject) => {
      const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit' });

// AFTER
    console.log('Performing final server health gating check before launching Playwright...');
    let gatingRetries = 15;
    let gatingHealthy = false;
    while (gatingRetries > 0 && !gatingHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:3000/login');
        if (res.ok || res.status === 200 || res.status === 404) {
          gatingHealthy = true;
          console.log('Next.js server is confirmed healthy post-stabilization.');
          break;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 1000));
      gatingRetries--;
    }
    if (!gatingHealthy) {
      throw new Error('Next.js server health gating check failed: http://127.0.0.1:3000/login is unreachable before Playwright launch.');
    }

    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    await new Promise((resolve, reject) => {
      const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit' });
```

---

## 5. Verification Method

1. **Inspect Modified Files**:
   - Verify `e2e/suppress_crashes.js` contains `if (signal === 0) return origKill(pid, signal);`.
   - Verify `e2e/run_e2e.ts` contains the `gatingRetries` health check loop prior to Playwright spawn.
2. **Execute E2E Test Runner**:
   Run the master verification command defined in `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
3. **Expected Outcome**:
   - All tests must pass with exit code 0.
   - The log must display `Next.js server is confirmed healthy post-stabilization.` before Playwright tests begin.
   - Zero occurrences of `Next.js server exited unexpectedly with code null`.
4. **Invalidation Conditions**:
   - Any test timeout or failure to reach `http://127.0.0.1:3000/login` during the gating check invalidates the fix.
