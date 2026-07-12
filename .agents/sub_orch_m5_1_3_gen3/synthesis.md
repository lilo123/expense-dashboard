# Synthesis Report: M5.3 Iteration 9 Explorer Investigations

## Consensus
All 3 Explorers (Explorer 1 gen9, Explorer 2 gen9, Explorer 3 gen9) reached 100% consensus on the root causes of the E2E test harness failures and the concrete 5-point fix strategy.

### 1. Root Causes of E2E Test Harness Failures
- **`permission denied` Database Failures**: When `postBuildRetries` or `preSeedRetries` hits 30 in `e2e/run_e2e.ts`, `robustSupabaseRestart()` performs a clean restart of Supabase. This clean restart applies `alter default privileges` (revoking permissions from `anon`, `authenticated`, `service_role`). Because `robustSupabaseRestart()` does NOT invoke `npx tsx e2e/init_db.ts`, `GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;` is never executed. Consequently, `e2e/seed.ts` and all subsequent Playwright tests fail with `permission denied`. Furthermore, `postBuildRetries` silently swallows the `seed.ts` failure, allowing Playwright E2E tests to run against a broken/empty database.
- **`supabase start is already running` & Lock Collisions**: `teardownSupabase()` filters out `npx`, `node`, and `npm` (`grep -v npx | grep -v node | grep -v npm`), failing to kill lingering `npx supabase start` processes from the first attempt. When `setup()` immediately retries, the lingering process causes a lock collision (`supabase start is already running.`).
- **`network supabase_network_expense-dashboard not found`**: `teardownSupabase()` aggressively deletes `supabase_network_expense-dashboard`, causing subsequent `npx supabase start` retries to fail because Supabase CLI expects the network to persist or be managed by its own lifecycle.
- **Container Prune Conflicts & Mutex Destruction**: Concurrent test runners deleting `/tmp/run_e2e.lock` bypass the mutex lock, causing simultaneous `npx supabase start` invocations that collide during Docker prune and container creation.

### 2. Concrete Fix Strategy
The implementation team must execute the following concrete fix strategy:

1. **Deploy Proposed `e2e/run_e2e.ts`**: Copy `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_3_gen9/proposed_run_e2e.ts` to `e2e/run_e2e.ts`.
   - **`teardownSupabase()` Fix**: Removes `docker network rm` commands to preserve `supabase_network_expense-dashboard`. Removes `grep -v npx | grep -v node | grep -v npm` from `killCmd` and adds explicit `pkill -9 -f "supabase.*start"` and `rm -rf supabase/.temp/*`.
   - **`setup()` Fix**: Implements a robust 5-retry loop (`while (retries > 0 && !reachable)`) with 5-second backoff (`await new Promise(resolve => setTimeout(resolve, 5000))`).
   - **`robustSupabaseRestart()` & `postBuildRetries` Fix**: Explicitly executes `execSync('npx tsx e2e/init_db.ts', ...)` after `sleep 10` in `robustSupabaseRestart()` and before `e2e/seed.ts` in `postBuildRetries`, ensuring database permissions are fully restored before seeding. Removes the silent `try/catch` swallowing of `seed.ts` errors.

2. **Deploy Proposed `e2e/adv_supabase_dns_nxdomain.ts`**: Copy `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_3_3_gen9/proposed_adv_supabase_dns_nxdomain.ts` to `e2e/adv_supabase_dns_nxdomain.ts`.
   - **`teardownSupabase()` Fix**: Removes `docker network rm` commands and adds `pkill -9 -f "supabase.*start"`.

3. **Sanitize Test Invocation Strings**: Ensure all test invocation strings strictly invoke `node node_modules/.bin/tsx e2e/run_e2e.ts` directly without executing `rm -f /tmp/run_e2e.lock /tmp/run_e2e.queue`.

## Resolved Conflicts
None. All 3 Explorers are in perfect alignment.

## Dissenting Views
None. 100% consensus.

## Gaps
None.
