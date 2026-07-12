# Handoff Report — Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases), Iteration 3 Explorer 1

## Observation
- **File Investigated**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/suppress_crashes.js`
  - **Lines 11-13**:
    ```javascript
    process.kill = (pid, signal) => {
      console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
    };
    ```
  - **Tool Command Used**: `view_file` on `e2e/suppress_crashes.js`.
  - **Direct Observation**: `process.kill` is monkey-patched to unconditionally log an error and return `undefined`. The original `process.kill` function is neither saved nor invoked for any signal, including `signal === 0`.

- **File Investigated**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
  - **Lines 441-446**:
    ```typescript
    console.log('Allowing Next.js and Supabase services 10 seconds to fully stabilize...');
    for (let w = 0; w < 5; w++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try { await fetch('http://127.0.0.1:3000/login'); } catch(e){}
    }
    console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
    ```
  - **Tool Command Used**: `view_file` on `e2e/run_e2e.ts`.
  - **Direct Observation**: During the 10-second stabilization window, `run_e2e.ts` executes `fetch` requests but catches and ignores all errors (`catch(e){}`). Immediately after the loop, Playwright is spawned without any gating health check to verify if the Next.js server is actually alive and responsive.

- **Verbatim Errors from Reviewer 2 Feedback**:
  - `Next.js server exited unexpectedly with code null`
  - Cascading 30-second test timeouts across all 55 E2E tests due to Playwright launching against an uninitialized server.

## Logic Chain
1. **Suppression of Liveness Checks**: Based on the observation of `e2e/suppress_crashes.js` (lines 11-13), `process.kill(pid, signal)` unconditionally intercepts all calls. In Node.js, `process.kill(pid, 0)` is used to test for process existence and returns `true` if the process exists. Because the monkey-patched function returns `undefined` (falsy) and does not execute the actual check, the Next.js 16 master process incorrectly perceives its worker child process as dead.
2. **Forced Server Termination**: Because the Next.js master process perceives its worker child process as dead during the 10-second stabilization window, it forcibly terminates the server, resulting in the observed error `Next.js server exited unexpectedly with code null`.
3. **Lack of Pre-Flight Health Gating**: Based on the observation of `e2e/run_e2e.ts` (lines 441-446), the 10-second stabilization loop silently swallows all `fetch` failures. When the Next.js server terminates or is in the middle of respawning, `run_e2e.ts` proceeds directly to launch Playwright (`npx playwright test`) without verifying if `http://127.0.0.1:3000/login` is reachable.
4. **Cascading Test Timeouts**: Launching Playwright against a dead or uninitialized server causes all 55 E2E tests to fail with cascading 30-second timeouts.
5. **Required Fix Strategy**: 
   - In `e2e/suppress_crashes.js`, we must store `const origKill = process.kill;` and add `if (signal === 0) return origKill(pid, signal);` so that liveness checks function correctly while destructive signals (SIGTERM/SIGINT/etc.) remain suppressed.
   - In `e2e/run_e2e.ts`, we must add a robust pre-flight health gating check after the 10-second stabilization window and before spawning Playwright, ensuring the server is fully responsive before tests begin.

## Caveats
- **Scope of Investigation**: The investigation was strictly read-only and focused on `e2e/suppress_crashes.js`, `e2e/run_e2e.ts`, and the E2E test runner setup as requested.
- **Assumptions**: We assume `signal === 0` is the only non-destructive signal used by Next.js 16 for liveness checks. We also assume `http://127.0.0.1:3000/login` remains the correct health check endpoint for the Next.js server as established earlier in `run_e2e.ts`.
- **Alternative Interpretations**: None. The failure mechanism perfectly aligns with Reviewer 2's findings.

## Conclusion
The verification suite failure is caused by `e2e/suppress_crashes.js` unconditionally suppressing `process.kill(pid, 0)` liveness checks, leading Next.js 16 to terminate the server, combined with `e2e/run_e2e.ts` lacking a pre-flight health check before launching Playwright.

### Recommended Concrete Fix Strategy (To be implemented by Worker)

1. **Modify `e2e/suppress_crashes.js`**:
   ```javascript
   // Before (Lines 11-13)
   process.kill = (pid, signal) => {
     console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
   };

   // After
   const origKill = process.kill;
   process.kill = (pid, signal) => {
     if (signal === 0) {
       return origKill(pid, signal);
     }
     console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
   };
   ```

2. **Modify `e2e/run_e2e.ts` (Insert before Line 446)**:
   ```typescript
   // Insert right after the 10-second stabilization loop and before spawning Playwright
   console.log('Performing final pre-flight health check on Next.js server at http://127.0.0.1:3000/login...');
   let preFlightRetries = 15;
   let preFlightHealthy = false;
   while (preFlightRetries > 0 && !preFlightHealthy) {
     try {
       const res = await fetch('http://127.0.0.1:3000/login');
       if (res.ok || res.status === 200 || res.status === 404) {
         preFlightHealthy = true;
         console.log('Next.js server is confirmed healthy post-stabilization.');
         break;
       }
     } catch (e) {}
     if (!preFlightHealthy) {
       console.log(`Waiting for Next.js server to be healthy pre-flight... (${preFlightRetries} retries left)`);
       await new Promise(resolve => setTimeout(resolve, 1000));
       preFlightRetries--;
     }
   }
   if (!preFlightHealthy) {
     throw new Error('Next.js pre-flight health check failed: http://127.0.0.1:3000/login is unreachable before launching Playwright.');
   }
   ```

## Verification Method
To independently verify the fix once implemented:
1. **Inspect Modified Files**:
   - Verify `e2e/suppress_crashes.js` contains `const origKill = process.kill;` and `if (signal === 0) return origKill(pid, signal);`.
   - Verify `e2e/run_e2e.ts` contains the pre-flight health check loop immediately before `npx playwright test`.
2. **Execute E2E Test Runner**:
   - Run the full verification suite command defined in `TEST_READY.md`:
     ```bash
     export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
     ```
   - Expected result: All tests pass with exit code 0, no `Next.js server exited unexpectedly with code null` errors occur during the stabilization window, and Playwright executes successfully without 30-second timeouts.
3. **Execute Unit Tests**:
   - Run `npm run test __tests__/planner` to ensure zero regressions in business logic engines.
