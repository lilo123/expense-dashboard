# Milestone 5.3 Review & Handoff Report

## 1. Observation
- **Verification Command Failure**: During independent verification of the command `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`, the test runner `e2e/run_e2e.ts` failed with exit code 1.
- **Verbatim Error**:
```
=== [DB INITIALIZER] Connecting to local Postgres ===
...
Connected successfully to local Postgres at port 25432.
Granting permissions to anon, authenticated, and service_role...
Failed to initialize database: relation "public.expenses" does not exist
E2E Tests execution failed! Error: Command failed: npx tsx e2e/init_db.ts
```
- **Supabase Startup Logic in `e2e/run_e2e.ts`**: `e2e/run_e2e.ts` lines 62-111 check if Supabase is already running (`Checking if Supabase is already running and healthy...`). Because `e2e/adv_supabase_dns_nxdomain.ts` executes immediately prior and runs `npx supabase start --debug`, `run_e2e.ts` detects Supabase as running and logs `Supabase is already running and healthy. Skipping startup.`
- **Skipped Teardown & Reset**: Because `alreadyRunning` is true, `run_e2e.ts` skips `teardownSupabase()` and `npx supabase start --debug`. It then executes `npx --no-install supabase migration up --include-all`, which outputs `{"applied":[],"message":"Migrations applied"}` because the migration history table in the persisted database container already contains the migration records, even though the actual tables in the `public` schema (such as `expenses`) are missing or corrupted from previous runs.

## 2. Logic Chain
- **Sequential Execution Conflict**: The user's verification command explicitly chains `npx tsx e2e/adv_supabase_dns_nxdomain.ts` followed by `npx tsx e2e/run_e2e.ts`. `adv_supabase_dns_nxdomain.ts` starts Supabase to verify DNS resilience but does not reset or verify the database schema.
- **Flawed Assumption in `run_e2e.ts`**: `run_e2e.ts` assumes that if Supabase is reachable on port 54321 and Postgres responds to `SELECT 1`, the database is fully migrated and clean. By skipping `teardownSupabase()` and failing to execute `npx supabase db reset`, it allows the test runner to operate against a stale/corrupted database container where `supabase migration up` performs no action (`{"applied":[]}`).
- **Downstream Crash**: When `e2e/init_db.ts` executes `ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;`, Postgres throws `relation "public.expenses" does not exist`, aborting the E2E test suite before Playwright tests can run.

## 3. Caveats
- Playwright E2E tests (`e2e/calculator_tier3.spec.ts`), `e2e/verify_accumulation.ts`, and `e2e/verify_monte_carlo.ts` could not be executed during the automated verification run because `run_e2e.ts` aborted early with exit code 1.

## 4. Conclusion
- The implementation of Milestone 5.3 fails independent verification due to a critical flaw in the E2E test runner (`e2e/run_e2e.ts`). `run_e2e.ts` must be updated to ensure a clean database state (e.g., by unconditionally performing `teardownSupabase()` before starting Supabase, or by executing `npx supabase db reset`) rather than assuming an already-running Supabase instance has a valid schema.

## 5. Verification Method
- Execute the following command to independently verify the failure:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- Inspect the logs to observe `Failed to initialize database: relation "public.expenses" does not exist`.

---

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1

- **What**: E2E test runner (`e2e/run_e2e.ts`) fails with `relation "public.expenses" does not exist` when executed immediately after `e2e/adv_supabase_dns_nxdomain.ts`.
- **Where**: `e2e/run_e2e.ts`, lines 62-111 and 214.
- **Why**: `run_e2e.ts` skips Supabase teardown and clean startup if Supabase is already running. When `adv_supabase_dns_nxdomain.ts` leaves Supabase running, `run_e2e.ts` reuses the dirty database container. `npx supabase migration up` treats migrations as already applied (`{"applied":[]}`), leaving missing tables uncreated and causing `e2e/init_db.ts` to crash.
- **Suggestion**: Modify `e2e/run_e2e.ts` to remove the `alreadyRunning` bypass so that `teardownSupabase()` and `npx supabase start` run unconditionally, OR replace `npx supabase migration up` with `npx supabase db reset`.

## Verified Claims

- `supabase/config.toml` DNS resilience fix (`[realtime] enabled = false`, `ip_version = "IPv4"`) → verified via `adv_supabase_dns_nxdomain.ts` → PASS
- E2E test runner execution (`e2e/run_e2e.ts`) → verified via `run_command` → FAIL

## Coverage Gaps

- Playwright E2E tests (`e2e/calculator_tier3.spec.ts`) — risk level: HIGH — recommendation: investigate once `run_e2e.ts` database initialization is fixed.

## Unverified Items

- `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts` — reason not verified: blocked by upstream failure of `e2e/run_e2e.ts`.

---

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1

- **Assumption challenged**: `e2e/run_e2e.ts` assumes that an already-running Supabase instance (responding to `SELECT 1` on port 25432) possesses a fully migrated, clean database schema.
- **Attack scenario**: `e2e/adv_supabase_dns_nxdomain.ts` executes `npx supabase start --debug` first. If the underlying Docker volume persists from a previous run where migrations were recorded in `schema_migrations` but tables were dropped or modified, `run_e2e.ts` skips clean startup and `supabase migration up` does nothing.
- **Blast radius**: The entire E2E test suite fails to execute, blocking CI/CD pipelines and preventing verification of Tier 3 cross-feature combinations.
- **Mitigation**: Enforce unconditional clean teardown (`teardownSupabase()`) at the start of `run_e2e.ts`, or explicitly invoke `npx supabase db reset`.

## Stress Test Results

- Sequential execution of `adv_supabase_dns_nxdomain.ts` followed by `run_e2e.ts` → expected behavior: clean database initialization and successful test execution → actual behavior: `relation "public.expenses" does not exist` crash → FAIL

## Unchallenged Areas

- Web Worker Mulberry32 PRNG and columnar buffer zero-copy transfer — reason not challenged: blocked by E2E test runner database initialization failure.
