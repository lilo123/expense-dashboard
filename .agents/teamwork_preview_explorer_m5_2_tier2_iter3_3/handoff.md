# Handoff Report: Milestone 5.2, Iteration 3 (Explorer 3)

## Summary of Core Findings
The E2E verification suite fails due to a two-fold issue: `e2e/suppress_crashes.js` unconditionally monkey-patches `process.kill`, suppressing `process.kill(pid, 0)` liveness checks which causes Next.js 16 to perceive its worker processes as dead and forcibly terminate the server; meanwhile, `e2e/run_e2e.ts` lacks a health gating check after its 10-second stabilization window, allowing Playwright to launch against the terminated server and resulting in cascading 30-second timeouts across all 55 E2E tests.

---

## 1. Observation
- **`e2e/suppress_crashes.js` (lines 11-13)**:
  ```javascript
  process.kill = (pid, signal) => {
    console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
  };
  ```
  The monkey-patching of `process.kill` intercepts all calls regardless of the `signal` argument. `origKill` is neither stored nor invoked for `signal === 0`.

- **`e2e/run_e2e.ts` (lines 441-456)**:
  ```typescript
    // Run Playwright tests across all browsers sequentially
    console.log('Allowing Next.js and Supabase services 10 seconds to fully stabilize...');
    for (let w = 0; w < 5; w++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try { await fetch('http://127.0.0.1:3000/login'); } catch(e){}
    }
    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    await new Promise((resolve, reject) => {
      const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit' });
  ```
  During the 10-second stabilization window, `fetch` errors are silently ignored (`catch(e){}`). Immediately following the loop, `npx playwright test` is spawned without verifying if the Next.js server at `http://127.0.0.1:3000/login` is actually alive and responsive.

- **Reviewer 2 Iteration 2 Feedback**:
  Reviewer 2 observed `Next.js server exited unexpectedly with code null` during the stabilization window, followed by Playwright launching against an uninitialized server and causing cascading 30-second timeouts across all 55 E2E tests.

---

## 2. Logic Chain
1. **`process.kill(pid, 0)` Suppression**: In Node.js, `process.kill(pid, 0)` is the standard mechanism to check if a process is alive (it returns `true` if alive, or throws `ESRCH` if not). Next.js 16 master processes use this to perform liveness checks on worker child processes.
2. **Next.js Server Termination**: Because `e2e/suppress_crashes.js` unconditionally intercepts `process.kill` and returns `undefined` without performing the check, Next.js 16 incorrectly assumes its worker child process is dead or in an invalid state. This triggers a forcible termination (`Next.js server exited unexpectedly with code null`) during the 10-second stabilization window.
3. **Unfenced Playwright Launch**: `e2e/run_e2e.ts` waits 10 seconds but ignores all errors from `fetch('http://127.0.0.1:3000/login')`. When the loop finishes, it assumes the server is ready and spawns Playwright.
4. **Cascading Timeouts**: Playwright attempts to run 55 E2E tests against `http://127.0.0.1:3000`, but since the Next.js server has terminated (or is stuck in a respawn loop), every test hits its 30-second timeout, failing the entire verification suite.

---

## 3. Caveats
- **Read-Only Investigation**: As an Explorer agent, no code changes were directly implemented or tested. The recommended fixes must be applied by a Worker agent.
- **Assumptions**: It is assumed that once `process.kill(pid, 0)` behaves correctly, Next.js 16 will successfully verify its worker processes and remain stable.

---

## 4. Conclusion
To resolve the verification suite failure, two surgical changes must be implemented by the Worker:
1. **Allow `signal === 0` Passthrough in `e2e/suppress_crashes.js`**: Store the original `process.kill` reference and verify `if (signal === 0) return origKill(pid, signal);` before suppressing other signals.
2. **Add Server Health Gating Check in `e2e/run_e2e.ts`**: Implement a retry loop immediately before spawning Playwright to ensure `http://127.0.0.1:3000/login` returns a valid HTTP status (`res.ok || res.status === 200 || res.status === 404`), throwing an explicit error if the server is unreachable.

### Proposed Code Modifications

#### `e2e/suppress_crashes.js` (Lines 11-13)
```javascript
// Before
process.kill = (pid, signal) => {
  console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
};

// After
const origKill = process.kill;
process.kill = (pid, signal) => {
  if (signal === 0) return origKill(pid, signal);
  console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
};
```

#### `e2e/run_e2e.ts` (Lines 446-447)
```typescript
// Before
    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    await new Promise((resolve, reject) => {

// After
    console.log('Verifying Next.js server health immediately before launching Playwright...');
    let finalGateRetries = 15;
    let finalGateHealthy = false;
    while (finalGateRetries > 0 && !finalGateHealthy) {
      try {
        const res = await fetch('http://127.0.0.1:3000/login');
        if (res.ok || res.status === 200 || res.status === 404) {
          finalGateHealthy = true;
          console.log('Next.js server confirmed healthy pre-Playwright launch.');
          break;
        }
      } catch (e) {}
      if (!finalGateHealthy) {
        console.log(`Waiting for Next.js server to be healthy pre-Playwright launch... (${finalGateRetries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        finalGateRetries--;
      }
    }
    if (!finalGateHealthy) {
      throw new Error('Next.js server health gating check failed: http://127.0.0.1:3000/login is unreachable before Playwright launch.');
    }

    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    await new Promise((resolve, reject) => {
```

---

## 5. Verification Method
Once the Worker implements the proposed changes, verify the fix using the following steps:
1. **Run E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts
   ```
2. **Expected Outcome**:
   - The console logs should show `Next.js server confirmed healthy pre-Playwright launch.` after the 10-second stabilization window.
   - The Next.js server should not log `Next.js server exited unexpectedly with code null`.
   - Playwright E2E tests should execute and pass with exit code 0.
