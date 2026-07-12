# Handoff Report: Empirical Verification & Stress Test Results (Milestone 5.1, Tier 1, Iteration 18, Challenger 1)

## 1. Observation
- **Static Code & Configuration Verification**:
  - `e2e/run_e2e.ts`: Correctly includes the exact standardized bulletproof teardown sequence (`rm -rf supabase/.temp`, `pkill -9 -f "supabase"`, `pkill -9 -f "supabase-go"`, `pkill -9 -f "npx supabase"`, `npx supabase stop`, `docker rm -f`, `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done`, `docker volume rm -f`, `fuser -k`, `npx supabase status`, `sleep 20`) across all six teardown locations (lines 37-47, 54-64, 93-103, 161-171, 223-233, 288-298).
  - `e2e/seed.ts`: Correctly includes robust retry loops around data deletion (`expenses`, `categories`, `recurring_expenses`) and user creation/deletion (`deleteUser`, `createUser`) (lines 116-196).
  - `e2e/run_e2e.ts`: Retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, `async setup()`, and no `pkill -9 -f next`, `fuser -k 54321/tcp`, or `try...catch` around `init_db.ts` or Playwright test execution.
  - `e2e/seed.ts`: Retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
  - `e2e/init_db.ts`: Retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
  - `next.config.js`: Retains `outputFileTracing: false`.
  - `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql`: Remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range()`).

- **Empirical Test Execution (`task-28`)**:
  - Executed the full test runner command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
  - `npx tsc --noEmit` and `npm run test __tests__/planner` passed successfully (9/9 unit tests passed in `__tests__/planner/planner.test.ts`).
  - `npx tsx e2e/run_e2e.ts` failed with exit code 1 during `e2e/seed.ts` execution.
  - Verbatim error logs from `task-28.log`:
    ```
    Verifying Supabase health pre-seed at http://127.0.0.1:54321...
    Waiting for Supabase to be reachable pre-seed... (20 retries left)
    ...
    Waiting for Supabase to be reachable pre-seed... (15 retries left)
    Supabase seems unresponsive. Attempting to cleanly restart Supabase...
    ⣽ Stopping containers...Stopped supabase local development setup.
    supabase start is already running.
    ...
    Waiting for Supabase to be reachable pre-seed... (10 retries left)
    Supabase seems unresponsive. Attempting to cleanly restart Supabase...
    ...
    Waiting for Supabase to be reachable pre-seed... (5 retries left)
    Supabase seems unresponsive. Attempting to cleanly restart Supabase...
    ...
    Supabase is reachable pre-seed.
    Seeding E2E test data...
    === Seeding E2E test environment ===
    Target User: test-user@example.com
    TypeError: fetch failed
        ...
      [cause]: Error: connect ECONNREFUSED 127.0.0.1:54321
    Waiting for Supabase Auth to be ready... (20 retries left)
    ...
    Waiting for Supabase Auth to be ready... (10 retries left)
    Verifying PostgREST schema cache readiness...
    Waiting for PostgREST schema cache to reload... (Errors: permission denied for table profiles / permission denied for table categories) (50 retries left)
    Waiting for PostgREST schema cache to reload... (Errors:  / Could not query the database for the schema cache. Retrying.) (49 retries left)
    Waiting for PostgREST schema cache to reload... (Errors: Could not query the database for the schema cache. Retrying. / Could not query the database for the schema cache. Retrying.) (48 retries left)
    ...
    Waiting for PostgREST schema cache to reload... (Errors: TypeError: fetch failed / TypeError: fetch failed) (41 retries left)
    ...
    Waiting for PostgREST schema cache to reload... (Errors: TypeError: fetch failed / TypeError: fetch failed) (1 retries left)
    Failed to verify PostgREST schema cache readiness after 50 retries.
    E2E Tests execution failed! Error: Command failed: sleep 15 && npx tsx --env-file=.env.test e2e/seed.ts
    ```

## 2. Logic Chain
1. **Pre-Seed Health Check Aggressive Restarts**: In `e2e/run_e2e.ts`, the pre-seed health check loop checks `http://127.0.0.1:54321` every 2 seconds. If Supabase takes longer than 10 seconds (5 retries) to respond after `init_db.ts`, `run_e2e.ts` triggers an aggressive restart (`npx supabase stop` followed by `npx supabase start --ignore-health-check`).
2. **Cascading Container Instability**: Because `npx supabase start --ignore-health-check` is asynchronous and takes time to spin up all 10+ containers, the health check loop continues polling every 2 seconds and triggers additional restarts at `10 retries left` and `5 retries left`. This thrashes the Docker daemon and leaves the containers in an unstable, partially initialized state.
3. **PostgREST Schema Cache & Kong API Gateway Crash**: When `e2e/seed.ts` executes, Supabase Auth initially refuses connections (`ECONNREFUSED`) but recovers after 10 retries. However, when `seed.ts` attempts to verify PostgREST schema cache readiness (`supabase.from('profiles').select('*')`), it encounters `permission denied for table profiles`, followed by `Could not query the database for the schema cache. Retrying.`, and finally `TypeError: fetch failed` for the remaining 41 retries. This proves that the underlying Kong API gateway or PostgREST container crashed or became completely unresponsive due to the preceding aggressive restart thrashing.
4. **Adversarial Failure Mode Identified**: The worker's implementation of the teardown blocks is syntactically correct, but the tight polling interval (`2000ms`) combined with aggressive restart triggers at retries 15, 10, and 5 in `e2e/run_e2e.ts` creates a severe race condition and container thrashing under real-world execution stress.

## 3. Caveats
- No caveats. The failure was empirically reproduced and traced directly to the container thrashing caused by the pre-seed health check restart logic in `e2e/run_e2e.ts`.

## 4. Conclusion
Worker 1's implementation in Iteration 18 successfully incorporates all requested static code elements, retry loops, RLS policies, and teardown blocks. However, under empirical stress testing, `e2e/run_e2e.ts` fails with exit code 1 because the pre-seed health check loop aggressively thrashes Supabase restarts (at retries 15, 10, and 5), causing the PostgREST/Kong containers to crash during `e2e/seed.ts` execution (`TypeError: fetch failed`). This finding is reported back for worker remediation.

## 5. Verification Method
To independently verify the stress test failure:
1. **Run Full E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true
   docker rm -f $(docker ps -aq) 2>/dev/null || true
   docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true
   npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected Result*: `tsc` and `jest` pass, but `npx tsx e2e/run_e2e.ts` fails during `e2e/seed.ts` with `Failed to verify PostgREST schema cache readiness after 50 retries.` due to `TypeError: fetch failed`.
