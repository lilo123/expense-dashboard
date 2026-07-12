# M5.1 Tier 1 E2E Test Pass - Reviewer 2 (Iteration 12) Handoff Report

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1: PostgREST Schema Cache Desynchronization & Container Restart Loop during E2E Seeding

- **What**: The E2E test runner (`npx tsx e2e/run_e2e.ts`) fails during `e2e/seed.ts` execution with exit code 1. The newly introduced PostgREST schema cache readiness check exhausts all 20 retries (60 seconds) and terminates the process.
- **Where**: `e2e/seed.ts` lines 87-109, and `e2e/run_e2e.ts` line 157.
- **Why**: During `seed.ts`, Supabase Auth takes ~30 seconds to become ready. Once Auth is ready, `seed.ts` polls `profiles` and `categories`. Initially, PostgREST returns `permission denied for table profiles / permission denied for table categories` because its schema cache has not synced the grants from `init_db.ts`. Subsequently, PostgREST/Kong crashes or restarts (`An invalid response was received from the upstream server` followed by `TypeError: fetch failed`). When PostgREST recovers, it enters a failure loop attempting to query the database catalog (`Could not query the database for the schema cache. Retrying.`). As a result, `seed.ts` fails, breaking the entire E2E test suite.
- **Suggestion**: 
  1. Increase `schemaRetries` in `e2e/seed.ts` from `20` to `40` (or `50`) to allow PostgREST sufficient time to recover from container restarts and successfully query the database catalog.
  2. Alternatively/additionally, in `e2e/run_e2e.ts`, after `init_db.ts` completes, explicitly restart or reload the PostgREST container (e.g. `npx supabase stop --no-backup && npx supabase start` or restarting the postgrest container directly) to ensure a clean schema cache before invoking `seed.ts`.

## Verified Claims

- **Prerequisite Process Cleanup** (`fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`) → verified via `run_command` → **PASS**
- **TypeScript Compilation & Type Safety** (`npx tsc --noEmit`) → verified via `run_command` → **PASS** (0 errors)
- **Unit Tests for Planner Business Logic Engines** (`npm run test __tests__/planner`) → verified via `run_command` → **PASS** (100% passing, 9/9 tests)
- **`e2e/run_e2e.ts` Docker Volume Cleanup** (`docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` in `setup()` and `cleanup()`) → verified via `view_file` → **PASS**
- **`e2e/seed.ts` Robust Retry Loop** (`schemaReady`, `schemaRetries = 20`, polling `profiles` and `categories`) → verified via `view_file` → **PASS** (Implemented correctly, but fails at runtime due to PostgREST crash loop)
- **Sanitization & Process Cleanup** (`next.config.js` retains `outputFileTracing: false`, `e2e/run_e2e.ts` retains `NODE_OPTIONS: ''`, lingering `run_e2e` pgrep/kill, removal of `suppress_crashes.js`, `fuser -k 3000/tcp`, no `try...catch` around `init_db.ts` or Playwright) → verified via `view_file` → **PASS**
- **Genuine Implementation & Strict RLS** (`src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS `auth.uid() = user_id` and Premium tier check triggers) → verified via `view_file` → **PASS** (No integrity violations or reward hacking detected)
- **Full E2E Test Runner Command** (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`) → verified via `run_command` → **FAIL** (Exit code 1)

## Coverage Gaps

- **PostgREST Container Health & Recovery Dynamics** — risk level: **HIGH** — recommendation: **investigate**. The root cause of `Could not query the database for the schema cache. Retrying.` indicates an underlying instability between PostgREST and Postgres during local Supabase startup and DDL migration pushing.

## Unverified Items

- **Playwright E2E Test Execution** — reason not verified: `e2e/seed.ts` failed during test setup, preventing the test runner from reaching the Playwright test execution phase.

---

## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### [High] Challenge 1: PostgREST Schema Cache Readiness Assumption under Container Instability

- **Assumption challenged**: The assumption that PostgREST will successfully reload its schema cache within 20 retries (60 seconds) after Supabase Auth becomes ready.
- **Attack scenario**: During automated E2E runs in resource-constrained or parallel environments, pushing DDL migrations (`supabase db push`) followed by `init_db.ts` (which sends `NOTIFY pgrst, 'reload schema'`) causes the PostgREST container to become unresponsive, crash (`TypeError: fetch failed`), and enter a recovery loop where it cannot query the database catalog (`Could not query the database for the schema cache. Retrying.`).
- **Blast radius**: `e2e/seed.ts` fails with exit code 1, aborting the entire E2E test suite before Next.js builds or Playwright tests can run.
- **Mitigation**: Increase `schemaRetries` to `40` or `50` in `e2e/seed.ts` and add an explicit PostgREST service restart or health check in `e2e/run_e2e.ts` after `init_db.ts` completes.

## Stress Test Results

- **E2E Test Runner Execution under Clean Docker State** → Expected: Supabase starts cleanly, seeds successfully, and runs Playwright tests → Actual: PostgREST enters a crash/restart loop during `seed.ts` polling, failing with `Could not query the database for the schema cache. Retrying.` → **FAIL**

## Unchallenged Areas

- **Playwright E2E UI Flows** — reason not challenged: Blocked by E2E seeding failure.

---

## 5-Component Handoff Report

### 1. Observation
We directly observed the following from our verification tool calls:
- **Prerequisite Process Cleanup**: Executed `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` successfully (`task-14`).
- **TypeScript Verification**: Executed `npx tsc --noEmit` successfully with zero errors (`task-14`).
- **Unit Test Verification**: Executed `npm run test __tests__/planner` successfully with 100% passing tests (9/9 tests passed, `task-14`).
- **`e2e/run_e2e.ts`**: Correctly includes `docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` in `setup()` (lines 39, 61) and `cleanup()` (line 85). Retains `NODE_OPTIONS: ''` sanitization (line 177), lingering `run_e2e` pgrep/kill (lines 162-174), removal of `suppress_crashes.js`, `fuser -k 3000/tcp`, and no `try...catch` around `init_db.ts` or Playwright.
- **`e2e/seed.ts`**: Correctly includes the robust retry loop verifying PostgREST schema cache readiness (`schemaReady`, `schemaRetries = 20`, polling `profiles` and `categories`) on lines 87-109.
- **`next.config.js`**: Retains `outputFileTracing: false` on line 3.
- **`src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`**: Remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`). No integrity violations or reward hacking detected.
- **E2E Test Runner Verification**: Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` (`task-29`). The command failed with exit code 1. Verbatim error logs from `task-29`:
  ```
  Waiting for Supabase Auth to be ready... (10 retries left)
  Verifying PostgREST schema cache readiness...
  Waiting for PostgREST schema cache to reload... (Errors: permission denied for table profiles / permission denied for table categories) (20 retries left)
  ...
  Waiting for PostgREST schema cache to reload... (Errors: An invalid response was received from the upstream server / An invalid response was received from the upstream server) (12 retries left)
  Waiting for PostgREST schema cache to reload... (Errors: TypeError: fetch failed / TypeError: fetch failed) (11 retries left)
  ...
  Waiting for PostgREST schema cache to reload... (Errors: Could not query the database for the schema cache. Retrying. / Could not query the database for the schema cache. Retrying.) (6 retries left)
  ...
  Waiting for PostgREST schema cache to reload... (Errors: Could not query the database for the schema cache. Retrying. / Could not query the database for the schema cache. Retrying.) (1 retries left)
  Failed to verify PostgREST schema cache readiness after 20 retries.
  E2E Tests execution failed! Error: Command failed: sleep 15 && npx tsx --env-file=.env.test e2e/seed.ts
  ```

### 2. Logic Chain
1. **Genuine Implementation & Guardrail Compliance**: Through direct file inspection (`view_file`), we verified that Worker 1 strictly adhered to all architectural guardrails and integrity constraints. `next.config.js` has `outputFileTracing: false`, `run_e2e.ts` cleans up lingering processes and avoids `try...catch` suppression, and the domain logic engines (`src/lib/planner/*.ts`) and Supabase migrations are genuinely implemented with strict RLS and Premium triggers. No reward hacking or mock facades exist.
2. **E2E Seeding Failure Mechanism**: Despite correct implementation of the requested retry loop in `e2e/seed.ts`, the E2E test runner fails at runtime. When `seed.ts` polls PostgREST for schema cache readiness, PostgREST initially returns `permission denied` because it has not yet processed the `NOTIFY pgrst, 'reload schema'` from `init_db.ts`. Subsequently, the PostgREST container crashes/restarts (`TypeError: fetch failed`), and upon rebooting, struggles to query the Postgres database catalog (`Could not query the database for the schema cache. Retrying.`). The 20 retries (60 seconds) expire before PostgREST recovers, causing `seed.ts` to exit with code 1 and fail the E2E suite.
3. **Verdict**: Because the E2E test runner fails with exit code 1, the implementation does not meet the Milestone 5.1 acceptance criteria (`npx tsx e2e/run_e2e.ts` must pass with exit code 0). Therefore, the verdict must be `REQUEST_CHANGES`.

### 3. Caveats
- Playwright E2E UI tests could not be executed or verified because the test runner failed during the database seeding phase (`e2e/seed.ts`).

### 4. Conclusion
Worker 1 correctly implemented all requested file modifications, TypeScript fixes, unit tests, and structural guardrails without any integrity violations. However, the E2E test runner fails during `e2e/seed.ts` due to a PostgREST container crash/restart loop (`Could not query the database for the schema cache. Retrying.`) that exhausts the 20-retry limit. We request changes to increase the retry limit in `e2e/seed.ts` (e.g. `schemaRetries = 40`) and/or add an explicit PostgREST service restart/stabilization step in `e2e/run_e2e.ts` after `init_db.ts`.

### 5. Verification Method
To independently verify these findings:
1. Run the prerequisite cleanup, TypeScript check, and unit tests:
   ```bash
   fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsc --noEmit
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner
   ```
2. Run the full E2E test runner command:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
3. Observe the failure during `e2e/seed.ts` with `Could not query the database for the schema cache. Retrying.` and exit code 1.
