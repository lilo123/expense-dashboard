# Milestone 5.3 Explorer Handoff Report

## 1. Observation
- **Sequential Execution Conflict & `alreadyRunning` Bypass**:
  - In `e2e/run_e2e.ts` (lines 49-63), the test runner checks if Supabase is reachable on port 54321 and Postgres responds to `SELECT 1`. If successful, it sets `alreadyRunning = true` and logs `Supabase is already running and healthy. Skipping startup.`
  - Because `e2e/adv_supabase_dns_nxdomain.ts` runs immediately prior in the verification chain (`npx tsx e2e/adv_supabase_dns_nxdomain.ts && ... npx tsx e2e/run_e2e.ts`) and leaves Supabase running, `run_e2e.ts` inherits the existing container state and skips `teardownSupabase()` and clean startup.
- **Silent Migration Failure on Dirty Containers**:
  - In `e2e/run_e2e.ts` (lines 210-230), `run_e2e.ts` executes `npx --no-install supabase migration up --include-all`.
  - Because the container is reused from `adv_supabase_dns_nxdomain.ts`, the migration history table already contains the migration records. `supabase migration up` outputs `{"applied":[],"message":"Migrations applied"}`, failing to create missing tables in the `public` schema.
  - When `e2e/init_db.ts` runs at line 231 (`execSync('npx tsx e2e/init_db.ts', ...)`), Postgres throws `relation "public.expenses" does not exist`, crashing the E2E test suite.
- **Fragile Supabase Startup & `PlatformError`**:
  - In `e2e/adv_supabase_dns_nxdomain.ts` (lines 20-50), `execSync('npx --no-install supabase start --debug', ...)` is executed without a retry loop or clean teardown mechanism upon failure. If `supabase-go` fails with `PlatformError` (`Unknown: ChildProcess.exitCode`), it enters a `fetch` loop that times out after 60 seconds and exits with code 1.
  - In `e2e/run_e2e.ts` (lines 71-111 and lines 140-151 in `robustSupabaseRestart`), `execSync('npx supabase start --debug', ...)` has minimal retry logic (only retrying once in `robustSupabaseRestart`). If `supabase-go` throws `PlatformError` on the retry, an uncaught exception terminates the test runner.
- **Supabase Configuration**:
  - In `supabase/config.toml` (lines 81-84), `[realtime] enabled = false` and `ip_version = "IPv4"` are configured, but `supabase-go` still experiences intermittent startup failures in isolated E2E environments.

## 2. Logic Chain
- **Step 1 (Stale Container State Inheritance)**: Because `adv_supabase_dns_nxdomain.ts` starts Supabase and leaves it running, `run_e2e.ts` detects Supabase as healthy (`alreadyRunning = true`) and skips `teardownSupabase()`.
- **Step 2 (Silent Migration Failure)**: `run_e2e.ts` executes `npx supabase migration up --include-all` against the dirty database container. Since the migration history table indicates migrations were previously applied, no tables are created, causing `e2e/init_db.ts` to crash with `relation "public.expenses" does not exist`.
- **Step 3 (Fragile Supabase Startup)**: `npx supabase start --debug` spawns `supabase-go`, which intermittently fails with `PlatformError` (`Unknown: ChildProcess.exitCode`) in isolated E2E environments. Without a robust retry loop and full teardown between attempts in both `adv_supabase_dns_nxdomain.ts` and `run_e2e.ts`, the E2E suite crashes prematurely.

## 3. Caveats
- We assume `supabase-go` failures are transient platform/network binding issues in the isolated environment that can be resolved via clean teardown and retry loops.
- We did not investigate modifying the underlying `supabase-go` binary or Docker daemon settings directly.

## 4. Conclusion
To achieve a bulletproof E2E test pass (M5.3), the implementer must execute the following fix strategy:
1. **Remove `alreadyRunning` Bypass & Ensure Clean Reset**:
   - In `e2e/run_e2e.ts`, remove the `alreadyRunning` check entirely so `teardownSupabase()` and `npx supabase start` run unconditionally in `setup()`.
   - Replace or supplement `npx --no-install supabase migration up --include-all` with `npx --no-install supabase db reset` to guarantee a clean database schema when chained after `adv_supabase_dns_nxdomain.ts`.
2. **Add Robust Error Handling & Retry Loops**:
   - In `e2e/adv_supabase_dns_nxdomain.ts`, add a full `teardownSupabase()` helper function (matching the one in `run_e2e.ts`) and wrap `execSync('npx --no-install supabase start --debug', ...)` in a robust retry loop (e.g., 5 retries). Before each retry, execute `teardownSupabase()` to cleanly wipe leftover containers/volumes and gracefully handle `PlatformError` / `Unknown: ChildProcess.exitCode`.
   - In `e2e/run_e2e.ts`, update `setup()` and `robustSupabaseRestart()` to utilize a robust retry loop (e.g., 5 retries) around `execSync('npx supabase start --debug', ...)`, ensuring `teardownSupabase()` executes before each retry.

## 5. Verification Method
- Inspect `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` to verify the removal of `alreadyRunning` and the addition of robust retry loops with `teardownSupabase()`.
- Execute the full verification command suite: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
- Verify exit code 0 and successful database initialization without `relation "public.expenses" does not exist` or `PlatformError` crashes.
