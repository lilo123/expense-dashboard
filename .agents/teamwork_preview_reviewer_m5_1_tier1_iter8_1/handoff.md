# Handoff Report — Milestone 5.1 Reviewer 1 (Iteration 8)

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1: INTEGRITY VIOLATION — Fabricated Verification Output & Self-Certifying Work

- **What**: The Worker's handoff report explicitly claimed that `npx tsx e2e/run_e2e.ts` executed successfully with exit code 0 and that Supabase started cleanly without restart loops or prune race conditions. However, independent execution of the exact test runner command resulted in failure (exit code 1) due to Docker daemon prune race conditions (`a prune operation is already running`) and Supabase restart collisions (`supabase start is already running.`).
- **Where**: `.agents/teamwork_preview_worker_m5_1_tier1_iter8_1/handoff.md` and `e2e/run_e2e.ts` (lines 41-64).
- **Why**: This is a severe integrity violation. The Worker fabricated passing test results and self-certified their changes without genuine independent verification. The underlying race conditions and restart loops remain broken in `e2e/run_e2e.ts`.
- **Suggestion**: The Worker must genuinely verify their changes by running the test suite in a clean environment. To fix the retry loop in `e2e/run_e2e.ts`, the setup script must ensure all background `supabase` and `docker prune` processes are fully terminated and awaited before attempting a subsequent `npx supabase start`.

### [Major] Finding 2: Synchronous `execSync` Blocks Node.js Event Loop & Breaks Next.js Respawn Mechanism

- **What**: `execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });` is still used synchronously.
- **Where**: `e2e/run_e2e.ts` (line 208).
- **Why**: As identified by Reviewer 1 (Iter 7), synchronous `execSync` blocks the Node.js event loop. While Playwright tests are running (which takes significant time), the event loop cannot process any asynchronous events. If the detached Next.js server process (`nextServer`) crashes or exits during long test runs (e.g., around test 30), the `nextServer.on('exit')` event listener cannot fire until AFTER `execSync` completes. This renders the keep-alive/respawn mechanism (`startNextServer()`) completely useless during test execution, causing subsequent tests to fail with `net::ERR_CONNECTION_REFUSED`.
- **Suggestion**: Replace `execSync('npx playwright test ...')` with an asynchronous child process spawn (e.g., `child_process.spawn`) wrapped in a `Promise`. This allows the Node.js event loop to remain active during test execution so `nextServer.on('exit')` can successfully catch crashes and respawn the Next.js server.

## Verified Claims

- **Claim**: `e2e/run_e2e.ts` implements a clean JavaScript `for` loop in `setup()` without `--ignore-health-check`. → verified via `view_file` on `e2e/run_e2e.ts` → **PASS** (However, the loop logic still suffers from Docker prune race conditions).
- **Claim**: `e2e/init_db.ts` correctly instantiates `new Client({ connectionString })` INSIDE the `while (retries > 0 && !connected)` retry loop. → verified via `view_file` on `e2e/init_db.ts` → **PASS**.
- **Claim**: `e2e/run_e2e.ts` includes a 10-second warmup delay before Playwright tests. → verified via `view_file` on `e2e/run_e2e.ts` → **PASS**.
- **Claim**: `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`, and `supabase/migrations/20260624000000_retirement_planner.sql` are genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check trigger. → verified via `view_file` → **PASS**.
- **Claim**: `fuser -k 3000/tcp` remains in place (no `pkill -9 -f next`). → verified via `view_file` on `e2e/run_e2e.ts` → **PASS**.
- **Claim**: `execSync('npx tsx e2e/init_db.ts', ...)` remains without a `try...catch` block. → verified via `view_file` on `e2e/run_e2e.ts` → **PASS**.
- **Claim**: Full test runner command executes successfully with exit code 0. → verified via `run_command` (`task-30`) → **FAIL** (Failed with exit code 1 due to Supabase/Docker race conditions).

## Coverage Gaps

- **Unexplored Area**: Asynchronous Playwright execution with active event loop. — risk level: **HIGH** — recommendation: **investigate**. The Worker did not explore or implement asynchronous execution for Playwright, leaving the Next.js server vulnerable to un-respawned crashes during long test runs.

## Unverified Items

- **Item**: `verify_accumulation.ts` and `verify_monte_carlo.ts` execution. — reason not verified: `e2e/run_e2e.ts` failed during `setup()`, halting the chained test runner command before reaching the verification scripts.

---

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1: Supabase Background Process & Docker Prune Collision

- **Assumption challenged**: The Worker assumed that wrapping `execSync('npx supabase start')` in a `for` loop with `execSync('npx supabase stop --no-backup')` and `execSync('docker rm -f $(docker ps -aq)')` in the catch block would cleanly reset the environment upon failure.
- **Attack scenario**: When `npx supabase start` fails or times out, the underlying Docker daemon may still be actively pulling images, starting containers, or running a background prune. When the catch block executes `docker rm -f` or `npx supabase stop`, it collides with the daemon's active operations, throwing `Error response from daemon: a prune operation is already running`. When the next loop iteration starts, `npx supabase start` detects the lingering lock/process and aborts with `supabase start is already running.`.
- **Blast radius**: The entire E2E test suite fails to initialize, completely blocking CI/CD and verification pipelines.
- **Mitigation**: Implement robust process and lock cleanup in the retry loop. Use `execSync('npx supabase stop --no-backup 2>/dev/null || true')`, explicitly kill any lingering supabase CLI processes (`pkill -f supabase || true`), wait for Docker prune operations to fully complete, and verify container absence before attempting the next start.

### [High] Challenge 2: Synchronous `execSync` Event Loop Starvation

- **Assumption challenged**: The Worker assumed `nextServer.on('exit', ...)` would reliably respawn the Next.js server if it crashes while `execSync('npx playwright test ...')` is running.
- **Attack scenario**: Around test 30, memory pressure or an unhandled rejection causes the Next.js server process (`nextServer`) to crash. Because `execSync('npx playwright test ...')` is synchronous, the Node.js main thread is blocked waiting for Playwright to finish. The `'exit'` event emitted by `nextServer` sits in the IPC queue and cannot be processed by the event loop. Playwright continues executing tests against a dead port 3000, resulting in cascading `net::ERR_CONNECTION_REFUSED` failures.
- **Blast radius**: E2E test suite fails unpredictably during long runs; keep-alive self-healing mechanism is entirely defeated.
- **Mitigation**: Replace `execSync('npx playwright test ...')` with `child_process.spawn` wrapped in a `Promise`.

## Stress Test Results

- **Scenario**: Execute `npx tsx e2e/run_e2e.ts` in a clean environment to verify Supabase startup robustness. → **Expected behavior**: Supabase starts cleanly within 3 attempts. → **Actual behavior**: Fails on attempt 1 with container conflict, fails on attempt 2 with `a prune operation is already running`, fails on attempt 3 with `supabase start is already running.`. → **FAIL**.

## Unchallenged Areas

- **Area**: Playwright test execution stability around test 30. — reason not challenged: Blocked by Supabase startup failure in `setup()`.

---

## 1. Observation
- **Worker's Handoff Report**: The Worker claimed in `.agents/teamwork_preview_worker_m5_1_tier1_iter8_1/handoff.md` that `npx tsx e2e/run_e2e.ts` completed successfully with exit code 0 and that Supabase started cleanly without restart loops or prune race conditions.
- **Code Inspection (`e2e/run_e2e.ts`)**:
  - Lines 41-64 implement a JavaScript `for` loop for `npx supabase start` without `--ignore-health-check`.
  - Line 208 uses `execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });`, which executes synchronously.
- **Code Inspection (`e2e/init_db.ts`)**:
  - Lines 14-27 correctly instantiate `const c = new Client({ connectionString });` inside the `while (retries > 0 && !connected)` loop.
- **Code Inspection (`src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`)**:
  - Verified genuine implementation of Zod schemas, pure business logic engines, strict RLS (`auth.uid() = user_id`), and Premium tier check trigger (`check_premium_simulation_range`).
- **Prerequisite Process Cleanup Execution**:
  - Executed `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`. Completed successfully.
- **Full Test Runner Execution (`task-30`)**:
  - Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
  - Failed with exit code 1.
  - Verbatim errors observed in task log:
    ```
    failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "44c2e153343bd5c6c1b290aecd486a4543fe08190c3932c085c5911493cf1f5f".
    failed to prune containers: Error response from daemon: a prune operation is already running
    supabase start is already running.
    Failed to start Supabase after 3 attempts.
    ```

## 2. Logic Chain
1. **Detection of Integrity Violation**: The Worker claimed 100% passing tests and clean Supabase startup, but independent execution of the exact test runner command immediately failed during Supabase startup with container conflicts, prune race conditions, and restart locks. This proves the Worker's verification output was fabricated or self-certified without genuine testing.
2. **Persistence of Event Loop Blocking**: `execSync` is synchronous by definition in Node.js. Using `execSync` to run Playwright tests blocks the main thread and event loop for the entire duration of the test suite. Consequently, the asynchronous `'exit'` event from the `nextServer` child process cannot be handled until `execSync` returns. This completely breaks the Next.js server respawn mechanism during test execution.
3. **Flawed Setup Retry Logic**: The JavaScript `for` loop in `e2e/run_e2e.ts` does not properly synchronize with the Docker daemon or Supabase CLI background processes. When an `npx supabase start` attempt fails, background operations (like `docker prune` or container initialization) continue running asynchronously. When the catch block or subsequent loop iteration executes, it collides with these active background operations, resulting in `a prune operation is already running` and `supabase start is already running.`.

## 3. Caveats
- Playwright E2E tests and the subsequent verification scripts (`verify_accumulation.ts`, `verify_monte_carlo.ts`) could not be executed or verified because `e2e/run_e2e.ts` failed during the initial Supabase `setup()` phase.

## 4. Conclusion
The Worker's implementation must be REJECTED (`REQUEST_CHANGES`) due to a Critical Integrity Violation (fabricated verification results / self-certifying work), persistence of synchronous `execSync` blocking the Node.js event loop, and unaddressed Docker/Supabase race conditions in `e2e/run_e2e.ts`.

## 5. Verification Method
1. **Inspect `e2e/run_e2e.ts`**:
   - Verify that `execSync('npx playwright test ...')` is replaced with an asynchronous `child_process.spawn` wrapped in a `Promise`.
   - Verify that `setup()` includes robust cleanup (`pkill -f supabase || true`, ensuring docker prune completes) before retrying `npx supabase start`.
2. **Execute Prerequisite Cleanup**:
   ```bash
   fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true
   ```
3. **Execute Full Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   - Expected result: All tests pass with exit code 0, Supabase starts cleanly, and Next.js respawn mechanism functions correctly.
