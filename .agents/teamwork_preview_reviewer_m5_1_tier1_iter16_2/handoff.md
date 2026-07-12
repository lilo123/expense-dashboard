# M5.1 Tier 1 Reviewer 2 (Iteration 16) Handoff Report

## 1. Observation
- **E2E Test Runner Inspection (`e2e/run_e2e.ts`)**:
  - Verified that `e2e/run_e2e.ts` contains `try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}` in all six teardown locations immediately after `docker rm -f` and before `docker volume rm -f` (lines 39, 53, 89, 154, 213, 275).
  - Confirmed `setup()` is `async`, retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
  - Confirmed `pkill -9 -f next` and `fuser -k 54321/tcp` remain removed.
  - Confirmed `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks.

- **Other Files Inspection**:
  - `e2e/seed.ts`: Retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
  - `e2e/init_db.ts`: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
  - `next.config.js`: Retains `outputFileTracing: false`.
  - `src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`: Confirmed genuine implementations with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`). No hardcoded test results or dummy/facade implementations found in the business logic engines.

- **Independent Verification Execution Results**:
  - Prerequisite process cleanup (`fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`): Completed successfully.
  - `npx tsc --noEmit`: Completed successfully with zero TypeScript compilation errors.
  - `npm run test __tests__/planner`: Completed successfully (100% passing unit tests, 9 passed / 9 total).
  - `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`: **FAILED** with exit code 1 during `npx tsx e2e/run_e2e.ts`.
    - Verbatim errors observed in task-38 log:
      ```
      Starting database...
      {"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start --ignore-health-check)"}}
      Supabase start attempt 1 failed. Checking status and cleaning up before retry...
      failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
      ...
      Supabase start attempt 2/3...
      supabase start is already running.
      ...
      Supabase start attempt 3/3...
      Starting database...
      Initialising schema...
      Stopping containers...
      failed to prune containers: Error response from daemon: a prune operation is already running
      error running container: exit 1
      ...
      Failed to start Supabase after 3 attempts.
      ```

## 2. Logic Chain
1. **Failure of Supabase Startup & Persistence of Docker Race Conditions**:
   - Worker 1 claimed that inserting `while docker ps -aq | grep -q .; do sleep 2; done` would eliminate `removal of container ... is already in progress`, `a prune operation is already running`, `Unknown: ChildProcess.exitCode`, and `supabase start is already running`.
   - However, `docker ps -aq` only checks for the existence of container objects. It does NOT check whether the Docker daemon is actively running a background prune operation (`docker container prune` / `docker system prune`) initiated by the Supabase CLI.
   - Furthermore, `pkill -f supabase` in the teardown block does not reliably terminate child processes spawned by `npx supabase start` (such as `supabase-go`), leading to `supabase start is already running` during subsequent retry attempts.
2. **Evaluation of Worker 1's Claims**:
   - Worker 1's handoff report claimed `npx tsx e2e/run_e2e.ts` completed successfully with exit code 0. Given the deterministic/intermittent failure observed during independent verification with the exact errors Worker 1 claimed to have eliminated, Worker 1's verification either suffered from self-certifying assumptions without robust stress-testing or represents an unverified claim.

## 3. Caveats
- No caveats. The failure was directly observed during independent execution of the E2E test runner command in a clean environment.

## 4. Conclusion
**Verdict**: REQUEST_CHANGES

Worker 1's implementation in Iteration 16 fails to achieve a 100% E2E test pass. The synchronous waiting loop `while docker ps -aq | grep -q .; do sleep 2; done` is insufficient to prevent `a prune operation is already running` and `supabase start is already running` race conditions during Supabase startup.

## 5. Verification Method
- **Independent Verification Commands**:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
  npx tsc --noEmit
  npm run test __tests__/planner
  npx tsx e2e/run_e2e.ts
  ```
- **Expected Outcome**: `npx tsx e2e/run_e2e.ts` must complete successfully with exit code 0 without failing on Supabase startup or Docker daemon prune race conditions.

---

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1: Supabase Startup Failure & Docker Prune Race Condition

- **What**: `npx tsx e2e/run_e2e.ts` fails during Supabase startup with `Unknown: ChildProcess.exitCode`, `supabase start is already running`, and `failed to prune containers: Error response from daemon: a prune operation is already running`.
- **Where**: `e2e/run_e2e.ts` (lines 48-102, `setup()` retry loop).
- **Why**: `while docker ps -aq | grep -q .; do sleep 2; done` only checks if containers exist; it does not verify if the Docker daemon has finished background prune operations or if lingering `supabase-go` binaries are still running in the background.
- **Suggestion**: Enhance the teardown sequence in `e2e/run_e2e.ts` to explicitly kill `supabase-go` (`pkill -f supabase-go 2>/dev/null || true`) and implement a check/lock mechanism or sufficient backoff to ensure Docker daemon prune operations complete before invoking `npx supabase start`.

## Verified Claims

- `e2e/run_e2e.ts` contains `while docker ps -aq | grep -q .; do sleep 2; done` in all 6 locations → verified via `view_file` → PASS
- Retained requirements (`async setup()`, `NODE_OPTIONS: ''`, `pkill -9 -f next` removed, `fuser -k 54321/tcp` removed, no try-catch around init_db/Playwright) → verified via `view_file` → PASS
- `e2e/seed.ts`, `e2e/init_db.ts`, `next.config.js` retain required parameters → verified via `view_file` → PASS
- Genuine implementation of Planner business logic engines and strict RLS → verified via `view_file` and `npm run test __tests__/planner` → PASS
- `npx tsx e2e/run_e2e.ts` completes successfully with exit code 0 → verified via `run_command` → FAIL

## Coverage Gaps

- **Docker Daemon Background Operations** — risk level: HIGH — recommendation: investigate methods to synchronize or inspect active Docker daemon prune tasks before attempting `npx supabase start`.

## Unverified Items

- `npx tsx e2e/verify_accumulation.ts` and `npx tsx e2e/verify_monte_carlo.ts` — reason not verified: blocked by `npx tsx e2e/run_e2e.ts` failure in the combined test runner execution chain.

---

## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### [High] Challenge 1: Docker Daemon Prune & Supabase CLI Process Leak

- **Assumption challenged**: The assumption that `docker ps -aq | grep -q .` being empty and `pkill -f supabase` guarantee a clean state for `npx supabase start`.
- **Attack scenario**: When `npx supabase start` fails or is stopped, the Supabase CLI (`supabase-go`) initiates background `docker container prune` operations. If `e2e/run_e2e.ts` immediately retries `npx supabase start`, the new instance collides with the lingering `supabase-go` process (`supabase start is already running`) and the active daemon prune (`a prune operation is already running`).
- **Blast radius**: Complete failure of the E2E test suite during the setup phase, preventing any Playwright tests or subsequent verification scripts from running.
- **Mitigation**: Add `pkill -f supabase-go 2>/dev/null || true` to the teardown blocks and introduce an explicit check or extended backoff for Docker daemon locks before retrying `npx supabase start`.

## Stress Test Results

- `export PATH=... && npx tsx e2e/run_e2e.ts && ...` → Expected: clean Supabase startup and passing tests → Actual: failed with `a prune operation is already running` and `supabase start is already running` → FAIL

## Unchallenged Areas

- Playwright E2E UI execution — reason not challenged: blocked by Supabase startup failure.
