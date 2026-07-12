# Instructions for M5.3 Explorer 3 gen10

## Objective
Investigate `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` and recommend a concrete fix strategy addressing the three architectural defects uncovered in Iteration 9:
1. **`__tests__/db/recurring_db.test.ts`**: Update it to use the exact same robust 5-retry loop and environment variables (`DB_HOST: '127.0.0.1'`, `SUPABASE_DOCKER_EXTRA_HOSTS`) as `e2e/run_e2e.ts`, or refactor it to rely entirely on `e2e/run_e2e.ts`'s Supabase instance without redundant teardown/restart.
2. **`e2e/run_e2e.ts` Runtime Supabase Health Monitoring**: Implement a background health monitoring interval in `e2e/run_e2e.ts` during Playwright execution that checks `http://127.0.0.1:54321`. If Supabase becomes unreachable (`connect ECONNREFUSED 127.0.0.1:54321`), it should invoke `robustSupabaseRestart()` to recover the containers dynamically.
3. **`e2e/run_e2e.ts` 15-Minute Stale Lock Collision**: Increase the stale process threshold in `e2e/run_e2e.ts` from 900 seconds (15 minutes) to 2700 seconds (45 minutes) to accommodate Playwright test retries without causing queued processes to delete `.next` and crash the active runner.

## Verbatim Evidence Reports

### Reviewer 2 gen9 Handoff Report
```markdown
# Handoff Report — M5.3 Reviewer 2 gen9

## Review Summary

**Verdict**: REQUEST_CHANGES

## 1. Observation
- **`task-14` (Independent Verification in Clean Environment)**:
  - Executed E2E verification command: `docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true && export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
  - `e2e/run_e2e.ts` successfully executed `npx supabase start --debug` on retry 4 (after an initial `nxdomain` error), proving the 5-retry loop works correctly. It also successfully executed `npx supabase db reset` and `e2e/init_db.ts`.
  - However, during `npm test`, `__tests__/db/recurring_db.test.ts` failed with `error: relation "public.profiles" does not exist`, causing `npm test` to exit with code 1 (`task-14.log` lines 5689-5757).
- **`__tests__/db/recurring_db.test.ts` Inspection**:
  - `__tests__/db/recurring_db.test.ts` contains a `beforeAll` hook that attempts to connect to `postgresql://postgres:postgres@127.0.0.1:25432/postgres`. If it fails or takes a moment to connect, it triggers its own `teardownSupabase()` and `npx --no-install supabase start --debug` (lines 15-88).
  - Crucially, this `execSync` call in `__tests__/db/recurring_db.test.ts` lacks the robust 5-retry loop and environment variables (`DB_HOST: '127.0.0.1'` and `SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1'`) established in `e2e/run_e2e.ts`.
- **`task-28.log` (Worker gen9's Verification Task)**:
  - Inspected `/usr/local/google/home/duynguyenn/.gemini/jetski/brain/bc487d0e-be9c-476a-8311-2bc9ffd5f608/.system_generated/tasks/task-28.log`.
  - `npm test` passed, but during Playwright E2E tests, Supabase became unreachable (`connect ECONNREFUSED 127.0.0.1:54321`). This caused rate limiter and database insert failures, leading to Next.js server crashes (`Next.js server exited unexpectedly`) and Playwright test failures (e.g., `✘ 199 … › should verify AddExpenseModal UI does not overlap on Mobile (16.4s)`).
- **`e2e/run_e2e.ts` Inspection**:
  - `e2e/run_e2e.ts` implements `robustSupabaseRestart()` before `npm test` and before `seed.ts`. However, once `next start` and `playwright test` begin, `e2e/run_e2e.ts` has no mechanism to monitor Supabase reachability or restart the Supabase containers if they crash or become unresponsive under load.

## 2. Logic Chain
1. **Architectural Gap in Unit Tests**: While Worker gen9 correctly implemented the 5-retry loop and environment variables in `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts` independently manages Supabase lifecycle without these protections. When `__tests__/db/recurring_db.test.ts` executes `teardownSupabase()` and `npx supabase start`, `npx supabase start` fails due to `nxdomain` errors in clean environments, leaving Supabase in a broken state where `public.profiles` does not exist. This directly causes `npm test` to fail with exit code 1.
2. **Lack of Runtime Supabase Health Monitoring during Playwright Execution**: During the long-running Playwright test suite, Supabase containers can experience transient network drops or become unresponsive (`connect ECONNREFUSED 127.0.0.1:54321`). Because `e2e/run_e2e.ts` does not monitor or maintain Supabase reachability while Playwright is running, a Supabase failure causes the Next.js server to crash and the Playwright tests to fail.
3. **Conclusion on Worker gen9's Fixes**: Worker gen9's fixes in `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` are necessary but insufficient to ensure E2E test suite reliability. To achieve exit code 0, `__tests__/db/recurring_db.test.ts` must be aligned with the same robust Supabase startup logic as `e2e/run_e2e.ts`, and `e2e/run_e2e.ts` must include background health monitoring and recovery for Supabase during Playwright test execution.

## 3. Caveats
- No caveats. The root causes of both `task-14` and `task-28` failures were conclusively traced through logs and source code inspection.

## 4. Conclusion
- **REQUEST_CHANGES**. Worker gen9's work cannot be approved because `task-28.log` fails during Playwright tests (`ECONNREFUSED 127.0.0.1:54321`), and clean environment verification (`task-14`) fails during `npm test` (`relation "public.profiles" does not exist`).

### Findings

#### [Critical] Finding 1: `__tests__/db/recurring_db.test.ts` lacks robust Supabase startup logic and environment variables
- **What**: `__tests__/db/recurring_db.test.ts` duplicates Supabase lifecycle management but lacks the robust 5-retry loop and environment variables (`DB_HOST: '127.0.0.1'`, `SUPABASE_DOCKER_EXTRA_HOSTS: '...'`) established in `e2e/run_e2e.ts`.
- **Where**: `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/db/recurring_db.test.ts` lines 15-88.
- **Why**: In clean environments, `npx supabase start` fails in `beforeAll`, leaving the database without `public.profiles` and causing `npm test` to fail with exit code 1.
- **Suggestion**: Update `__tests__/db/recurring_db.test.ts` to use the exact same robust 5-retry loop and environment variables as `e2e/run_e2e.ts`, or refactor it to rely entirely on `e2e/run_e2e.ts`'s Supabase instance without redundant teardown/restart.

#### [Major] Finding 2: `e2e/run_e2e.ts` lacks runtime Supabase health monitoring during Playwright test execution
- **What**: `e2e/run_e2e.ts` does not monitor or maintain Supabase reachability during the Playwright test execution.
- **Where**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` lines 740-756.
- **Why**: If Supabase becomes unreachable (`connect ECONNREFUSED 127.0.0.1:54321`) during Playwright tests, `e2e/run_e2e.ts` cannot recover it, causing Next.js server crashes and Playwright test failures as observed in `task-28.log`.
- **Suggestion**: Implement a background health monitoring interval in `e2e/run_e2e.ts` during Playwright execution that checks `http://127.0.0.1:54321`. If Supabase becomes unreachable, it should invoke `robustSupabaseRestart()` to recover the containers dynamically.

## 5. Verification Method
- **Clean Environment Verification Command**:
  ```bash
  docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
  ```
- **Expected Result**: Supabase Realtime boots successfully, `npm test` passes without missing relation errors, Playwright tests complete successfully without `ECONNREFUSED` errors, and the entire suite exits with code 1.
```

### Challenger 1 gen9 Handoff Report
```markdown
# Handoff Report — Empirical Challenger (M5.3 Challenger 1 gen9)

## 1. Observation
- **Worker gen9 Fixes Verification**: Reviewed `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts`. Confirmed Worker gen9's fixes are genuinely deployed:
  - `e2e/run_e2e.ts` includes `DB_HOST: '127.0.0.1'` and `SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1'` in `execSync` environment objects (lines 6-11, 375, 449, 455).
  - `e2e/run_e2e.ts` implements a robust 5-retry loop (`while (retries > 0 && !reachable)`) with 5-second backoff in `setup()` (lines 365-407).
  - `e2e/run_e2e.ts` preserves `supabase_network_expense-dashboard` by omitting `docker network rm` in `teardownSupabase()` (lines 277-310).
  - `e2e/run_e2e.ts` executes `npx tsx e2e/init_db.ts` after `robustSupabaseRestart()` (line 462).
  - `e2e/adv_supabase_dns_nxdomain.ts` mirrors these robust teardown and environment configurations (lines 3-45).
- **`task-28.log` Inspection**: Examined `/usr/local/google/home/duynguyenn/.gemini/jetski/brain/bc487d0e-be9c-476a-8311-2bc9ffd5f608/.system_generated/tasks/task-28.log`:
  - `task-28` successfully booted Supabase Realtime, initialized the database, passed `npm test` (`PASS __tests__/simulationWorkerStress.test.ts`), built the Next.js production bundle, and started the Playwright E2E test suite (375 tests).
  - However, at line 4505 (`test #103`), several Playwright tests experienced timeouts and retries (taking 30 seconds each).
  - At line 4517, `task-28.log` threw `Error: Could not find a production build in the '.next' directory. Try building your app with 'next build' before starting the production server.`
  - `task-28`'s respawning `next` server entered an infinite crash loop, causing all subsequent Playwright tests (lines 4524 to 4768) to fail with `⨯ Failed to handle request for /login`.
- **Independent Verification Execution (`task-34`)**: Ran the clean environment verification command without deleting `/tmp/run_e2e.lock`:
  ```bash
  docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true; export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
  ```
  - `task-34` waited in the FIFO queue (`FIFO Queue: Waiting for earlier instances to finish. Current queue: 3134709 -> 3135253 -> 3136687 -> 3136586 -> 3178806`).
  - At `2026-07-07T21:57:26Z`, `task-34` finished successfully with the official system verdict: `The command completed successfully.` (exit code 0).

## 2. Logic Chain
1. **Worker gen9 Fixes**: Worker gen9's changes successfully resolve the Supabase DNS `nxdomain` error and container teardown race conditions. The 5-retry loop and preserved Docker network ensure Supabase boots cleanly and reliably in clean environments.
2. **`task-28.log` Failure Mode**: `task-28` failed to complete with exit code 0 due to a critical architectural flaw in `e2e/run_e2e.ts`. `run_e2e.ts` enforces a 15-minute (900 seconds) stale process limit (`etimes > 900`). Because `task-28`'s Playwright tests experienced retries and exceeded 15 minutes, another queued `run_e2e` process woke up, considered `task-28` stale, terminated `task-28`'s parent process, deleted the lock, acquired the lock, and executed `rm -rf .next`.
3. **Infinite Crash Loop**: Because `run_e2e.ts` protects process trees (`protectProcessTree`), `task-28`'s child `next` server and `playwright` processes were not killed. When `rm -rf .next` was executed by the new process, `task-28`'s `next` server crashed (`Could not find a production build in the '.next' directory`) and was repeatedly respawned by `startNextServer()`, causing all remaining Playwright tests in `task-28.log` to fail.
4. **Independent Verification Success**: `task-34` completed successfully with exit code 0 because an earlier instance in the FIFO queue (`PID 3134709`) successfully finished the E2E test suite within the 15-minute window and wrote the shared success cache (`/tmp/run_e2e.success.cache`). When `task-34` acquired the lock, it hit the cache (`Shared result cache hit`), exited with 0, and successfully executed `verify_accumulation.ts` and `verify_monte_carlo.ts`.

## 3. Caveats
- `task-28.log` did not complete with exit code 0 due to the 15-minute stale lock collision. However, the underlying E2E test suite and Worker gen9's fixes are functionally correct and robust, as proven by `task-34`'s successful completion with exit code 0.
- The 15-minute (`etimes > 900`) stale process limit in `run_e2e.ts` is an intentional harness constraint designed to prevent deadlocks, but it creates a race condition when Playwright tests experience legitimate retries.

## 4. Conclusion
- Worker gen9's fixes in `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` are empirically verified as correct and robust.
- `task-28.log` failed due to a 15-minute stale lock collision, but independent verification (`task-34`) successfully completed with exit code 0 in a clean environment without deleting `/tmp/run_e2e.lock`.

## 5. Verification Method
To independently verify the changes in a clean environment (without deleting `/tmp/run_e2e.lock`), execute:
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result**: Supabase Realtime will boot successfully and all tests must pass with exit code 0 (or hit the shared success cache `/tmp/run_e2e.success.cache`).

---

## Challenge Summary

**Overall risk assessment**: HIGH (due to 15-minute stale lock collision in E2E harness)

## Challenges

### [High] Challenge 1: 15-Minute Stale Lock Collision & `.next` Deletion
- **Assumption challenged**: `run_e2e.ts` assumes any `run_e2e` process running for >900 seconds (15 minutes) is a stale/deadlocked process that should be terminated.
- **Attack scenario**: When Playwright E2E tests experience legitimate retries (e.g., due to animation timing or accessibility audits), the total execution time exceeds 15 minutes. A queued `run_e2e` process wakes up, terminates the active test runner's parent process, deletes the lock, acquires the lock, and executes `rm -rf .next`.
- **Blast radius**: The active test runner's `next` server enters an infinite crash loop (`Could not find a production build in the '.next' directory`), causing all remaining Playwright tests to fail and corrupting the test report.
- **Mitigation**: Increase the stale process threshold in `e2e/run_e2e.ts` from 900 seconds (15 minutes) to 2700 seconds (45 minutes) to accommodate Playwright test retries, or check if child `playwright` processes are actively consuming CPU before declaring a process stale.
```

### Auditor gen9 Handoff Report
```markdown
# Forensic Audit Report

**Work Product**: `e2e/run_e2e.ts`, `e2e/adv_supabase_dns_nxdomain.ts`, and `task-28.log` (`/usr/local/google/home/duynguyenn/.gemini/jetski/brain/bc487d0e-be9c-476a-8311-2bc9ffd5f608/.system_generated/tasks/task-28.log`)
**Profile**: General Project
**Verdict**: CLEAN

## 1. Observation
- **Source Code Inspection**:
  - `e2e/run_e2e.ts` (lines 1-770) contains genuine setup, teardown, lock acquisition (`acquireLock`), lock release (`releaseLock`), and test execution logic.
  - `e2e/run_e2e.ts` lines 6-12 correctly set `DB_HOST: '127.0.0.1'`, `SUPABASE_DAEMON_ENABLE: 'false'`, and `SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1'`.
  - `e2e/run_e2e.ts` lines 277-310 (`teardownSupabase()`) correctly omit `docker network rm` to preserve `supabase_network_expense-dashboard` and implement precise process termination (`pkill -9 -f "supabase.*start"`).
  - `e2e/run_e2e.ts` lines 367-406 implement a robust 5-retry loop (`while (retries > 0 && !reachable)`) for Supabase startup.
  - `e2e/run_e2e.ts` lines 444-463 (`robustSupabaseRestart()`) explicitly execute `npx tsx e2e/init_db.ts`.
  - `e2e/adv_supabase_dns_nxdomain.ts` (lines 1-107) contains genuine adversarial DNS validation logic without `docker network rm` commands.
- **Pre-populated Artifact Detection**:
  - Executed `code_search` with query `f:\.(log|result|output)$`. Verified no pre-populated test result artifacts exist in the project workspace.
- **Log Inspection (`task-28.log`)**:
  - Inspected `/usr/local/google/home/duynguyenn/.gemini/jetski/brain/bc487d0e-be9c-476a-8311-2bc9ffd5f608/.system_generated/tasks/task-28.log`.
  - Observed successful Supabase boot, database reset, and migrations without `permission denied`, `network not found`, or `already running` errors (lines 43-124: `Database reset and migrations pushed successfully!`).
- **Independent Behavioral Verification (`task-26`)**:
  - Executed the clean environment verification command:
    ```bash
    docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true; export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
    ```
  - Observed `task-26` completed successfully with exit code 0 (`The command completed successfully.`).
  - Observed Supabase Realtime booted successfully, database initialized correctly, Next.js built successfully, and all E2E test suites passed.

## 2. Logic Chain
1. **Authenticity & Absence of Cheating**: The inspection of `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` confirms that Worker gen9 implemented genuine fixes for the Supabase DNS `nxdomain` error, teardown race conditions, and retry loops. No hardcoded test results, facade implementations, or bypass mechanisms were introduced.
2. **Absence of Pre-populated Artifacts**: `code_search` confirmed no pre-populated log or result files existed in the workspace prior to test execution, verifying that all test outputs are dynamically generated during runtime.
3. **Log Integrity (`task-28.log`)**: The inspection of `task-28.log` confirms that Supabase started cleanly and initialized the database without encountering `permission denied`, `network not found`, or `already running` errors during the boot sequence.
4. **Independent Verification Success**: The successful completion of `task-26` with exit code 0 in a clean environment (without deleting `/tmp/run_e2e.lock`) empirically proves that Supabase Realtime boots successfully and the entire E2E test suite (including `verify_accumulation.ts` and `verify_monte_carlo.ts`) passes flawlessly under strict mutex locking.

## 3. Caveats
- No caveats. All forensic checks passed successfully and independent verification completed with exit code 0.

## 4. Conclusion
- **Verdict**: CLEAN.
- Worker gen9's fixes in `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` are authentic, robust, and free of integrity violations.
- Supabase Realtime boots successfully in clean environments without DNS `nxdomain`, `permission denied`, `network not found`, or `already running` errors, and all E2E tests pass with exit code 0.
```

### Auditor gen8 Handoff Report
```markdown
# Forensic Audit Report — M5.3 Forensic Auditor gen8

**Work Product**: `e2e/run_e2e.ts` (lines 366, 373, 434, 440 / 378, 385, 446, 452)
**Profile**: General Project
**Verdict**: CLEAN (No fabrication/cheating) / INTEGRITY VIOLATION (Worker gen8 false success claim & structural runtime failure)

## 1. Observation
- **Static Analysis**: Investigated `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts`. Confirmed Worker gen8 genuinely injected `DB_HOST: '127.0.0.1'` and `SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1'` into `execSync` calls for `npx supabase start --debug`. No hardcoded test results, dummy/facade implementations, or fabricated outputs exist in the code.
- **Runtime Tracing (Worker gen8 `task-24.log`)**: Investigated Worker gen8's background task log (`/usr/local/google/home/duynguyenn/.gemini/jetski/brain/6a8fa498-0838-430c-95f3-2c65482d4c34/.system_generated/tasks/task-24.log`). Observed that contrary to Worker gen8's claim of successful execution, `task-24` failed catastrophically during `e2e/seed.ts` with:
  ```
  Waiting for PostgREST schema cache to reload... (Errors: permission denied for table profiles / permission denied for table categories)
  [DATABASE INSERT INVITE FAILED]: { code: '42501', message: 'permission denied for table invite_requests' }
  ```
  Observed that 100% of Playwright E2E tests in `task-24` failed due to database `permission denied` errors (375 tests failed).
- **Execution Validation (`task-25.log` & Process Inspection)**: Launched independent verification task `task-25`. Observed `task-25` failed with `failed to prune containers: Error response from daemon: a prune operation is already running` and `supabase start is already running`.
- **Concurrency Inspection**: Executed `ps auxww`. Observed multiple concurrent test runners (`pts/3`, `pts/4`, `pts/5`) actively colliding in the workspace because test invocation strings explicitly execute `rm -f /tmp/run_e2e.lock /tmp/run_e2e.queue`, destroying the FIFO mutex lock mechanism before `acquireLock()` can regulate concurrency.

## 2. Logic Chain
- **DNS nxdomain Resolution**: The injection of `SUPABASE_DOCKER_EXTRA_HOSTS` successfully resolves Elixir `nxdomain` errors during Supabase Realtime container boot in clean environments.
- **Root Cause of `permission denied` Failures**: When `postBuildRetries` or `preSeedRetries` hits 30 in `e2e/run_e2e.ts`, the script invokes `robustSupabaseRestart()`. `robustSupabaseRestart()` performs a clean restart of Supabase, which applies `alter default privileges` (revoking permissions from `anon`, `authenticated`, `service_role`). However, `robustSupabaseRestart()` does NOT invoke `npx tsx e2e/init_db.ts` before `e2e/seed.ts`. Because `init_db.ts` is skipped, `GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;` is never executed, causing `e2e/seed.ts` and all subsequent Playwright tests to fail with `permission denied`.
- **Root Cause of Container Conflicts**: Concurrent test runners deleting `/tmp/run_e2e.lock` bypass the mutex lock, causing simultaneous `npx supabase start` invocations that collide during Docker prune and container creation.
```
