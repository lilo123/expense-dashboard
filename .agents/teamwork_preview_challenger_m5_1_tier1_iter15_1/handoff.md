# M5.1 Tier 1 Challenger (Iteration 15) Handoff Report

## 1. Observation
- **Verification of Retained Requirements & Modifications**:
  - `e2e/run_e2e.ts`: Confirmed `setup()` is converted to `async`, includes `await fetch('http://127.0.0.1:54321')`, removes manual `docker network create/rm` and `fuser -k 54321/tcp`, and wraps every `execSync` in individual `try...catch` blocks. Confirmed retention of `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and no `pkill -9 -f next` or `try...catch` around `init_db.ts` or Playwright test execution.
  - `e2e/seed.ts`: Confirmed retention of `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
  - `e2e/init_db.ts`: Confirmed retention of 10s post-notification delay (`setTimeout(resolve, 10000)`).
  - `next.config.js`: Confirmed retention of `outputFileTracing: false`.
  - `src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`: Confirmed genuine implementations with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`).
- **Empirical Test Runner Execution (`task-33`)**:
  - Executed the full test runner command specified in `TEST_READY.md`:
    ```bash
    export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
    ```
  - `npx tsc --noEmit` passed successfully with zero errors.
  - `npm run test __tests__/planner` passed successfully (1 test suite, 9 tests passed).
  - `npx tsx e2e/run_e2e.ts` failed with exit code 1 during `setup()`.
- **Verbatim Errors from `task-33.log`**:
  - Attempt 1: `{"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start --ignore-health-check)"}}`
  - Attempt 2: `Failed to remove container: 23ed294d36473f5156518ae887e4f11a98cd46bd48af00e38f61516ca239cec0 Error response from daemon: removal of container 23ed294d36473f5156518ae887e4f11a98cd46bd48af00e38f61516ca239cec0 is already in progress` followed by `Unknown: ChildProcess.exitCode`.
  - Attempt 3: `supabase start is already running. Stopped services: [supabase_kong_expense-dashboard supabase_auth_expense-dashboard ...]` followed by `supabase_db_expense-dashboard container is not ready: starting` and `Failed to start Supabase after 3 attempts.`

## 2. Logic Chain
1. **Refutation of Worker 1's Claims**:
   - Worker 1 claimed that removing `docker network create` resolved `Unknown: ChildProcess.exitCode` and that `task-23` completed successfully. Our empirical execution (`task-33`) proves this claim false. `supabase-go` still fails with `Unknown: ChildProcess.exitCode`.
2. **Analysis of `Unknown: ChildProcess.exitCode` & Container Removal Race Condition**:
   - In Attempt 2, `docker rm -f` fails because `removal of container ... is already in progress`. This demonstrates a race condition where Docker daemon's background container teardown collides with `e2e/run_e2e.ts`'s synchronous cleanup commands (`docker ps -aq | xargs -r docker rm -f`). The lingering container locks prevent `supabase-go` from initializing new containers, leading to `Unknown: ChildProcess.exitCode`.
3. **Analysis of `supabase start is already running` Partial State Flaw**:
   - In Attempt 3, `npx supabase start` detects the surviving/restarting `supabase_db_expense-dashboard` container and exits immediately with `supabase start is already running`. However, it leaves all other essential microservices (`supabase_kong_expense-dashboard`, `supabase_auth_expense-dashboard`, etc.) in `Stopped services`.
   - Because `supabase_kong_expense-dashboard` (the API gateway listening on port 54321) is stopped, the reachability check `await fetch('http://127.0.0.1:54321')` fails. `e2e/run_e2e.ts` exhausts its retries and aborts with `Failed to start Supabase after 3 attempts`.

## 3. Caveats
- **Untested Areas**: Because `e2e/run_e2e.ts` failed during Supabase setup, the subsequent Playwright E2E tests, `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts` could not be executed.

## 4. Conclusion
**Verdict**: FAILURE — FIX INCOMPLETE / UNRELIABLE SUPABASE STARTUP

Worker 1's implementation fails empirical verification. While `npx tsc --noEmit` and `npm run test __tests__/planner` pass perfectly, `e2e/run_e2e.ts` suffers from severe Docker container cleanup race conditions and partial Supabase startup states (`supabase start is already running` with stopped Kong gateway). This prevents the E2E test suite from executing.

### Challenge Summary
**Overall risk assessment**: CRITICAL

### Challenges
#### [Critical] Challenge 1: Supabase CLI / Docker Teardown Race Condition & Partial Startup
- **Assumption challenged**: Worker 1 assumed that removing `docker network create` and wrapping `execSync` in `try...catch` would allow `npx supabase start` to execute cleanly.
- **Attack scenario**: During `setup()`, `supabase-go` fails with `Unknown: ChildProcess.exitCode`. The cleanup block attempts `docker rm -f`, which collides with Docker daemon's internal removal (`removal of container ... is already in progress`). On the final retry, `supabase start` detects a surviving database container, assumes Supabase is running, and exits without starting the Kong API gateway (`Stopped services`).
- **Blast radius**: The Kong API gateway (port 54321) remains offline. The `fetch('http://127.0.0.1:54321')` reachability check fails, aborting the entire E2E test suite.
- **Mitigation**: 
  1. Replace `npx supabase stop --no-backup` and raw `docker rm -f` with a more robust, synchronous teardown that actively waits for containers to disappear (`while docker ps -aq | grep -q .; do sleep 2; done`).
  2. If `npx supabase start` reports `supabase start is already running` but services are stopped, explicitly run `npx supabase stop --no-backup` followed by `npx supabase start` to force a clean cold start of all services.

## 5. Verification Method
- **Independent Verification Command**:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
  ```
- **Expected Outcome**: `e2e/run_e2e.ts` fails with `Unknown: ChildProcess.exitCode` and `Failed to start Supabase after 3 attempts`, exiting with code 1.
