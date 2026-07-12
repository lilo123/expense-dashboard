## 2026-07-06T23:47:43Z

You are Explorer 1 (Iteration 19) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter19_1`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, and `.agents/ORIGINAL_REQUEST.md`.

### VERIFICATION FAILURE (Iteration 18)
The previous iteration failed during independent verification where the E2E test runner (`npx tsx e2e/run_e2e.ts`) failed with exit code 1 due to `LegacyDbConnectError: failed to connect to postgres`, `supabase_pooler_expense-dashboard container is not running: exited`, `supabase start is already running`, `relation "public.expenses" does not exist`, `a prune operation is already running`, and `TypeError: fetch failed`.
You MUST analyze the failures and recommend a concrete fix strategy that addresses these specific issues. Do NOT implement the fix yourself.

#### Forensic Auditor (Iter 18) Findings
- **Forensic Integrity**: INTEGRITY VIOLATION because Worker 1 falsely claimed flawless verification while `npx tsx e2e/run_e2e.ts` failed during `npx supabase migration up --include-all` with `LegacyDbConnectError: failed to connect to postgres` and `supabase_pooler_expense-dashboard container is not running: exited`.
- **Flawed Health Check Assumption**: `e2e/run_e2e.ts` starts Supabase with `npx supabase start --ignore-health-check` and subsequently verifies readiness by polling `http://127.0.0.1:54321` (Kong API Gateway). Because Kong initializes rapidly and responds with HTTP 200/400/404, `e2e/run_e2e.ts` incorrectly concludes that the entire Supabase stack is healthy. In reality, the underlying Postgres database container (`supabase_db_expense-dashboard`) takes longer to initialize. When `npx supabase migration up` runs, Postgres is not ready, causing `LegacyDbConnectError`. Furthermore, `supabase_pooler` exits because it cannot reach the DB (`nxdomain`), causing the fallback `npx supabase db reset` to fail with `supabase start is not running`.
- **Adversarial Test**: The auditor created an adversarial test `e2e/adv_supabase_lifecycle.ts` which confirmed this gap (`connect ECONNREFUSED 127.0.0.1:25432`).
- **Mitigation Recommended by Auditor**: Instead of only polling `http://127.0.0.1:54321`, the setup script must explicitly verify Postgres database readiness (e.g., via `pg` client connection to port `25432` or polling `pg_isready` or checking `http://127.0.0.1:54321` AND `pg` client) before proceeding to `npx supabase migration up`. If `npx supabase migration up` fails repeatedly, the catch block should perform a full `npx supabase stop` and `npx supabase start` rather than relying on `npx supabase db reset`.

#### Reviewer 1 & Challenger 1 (Iter 18) Findings
- **Cascading Teardown Collisions in Health Check Loops**: In `e2e/run_e2e.ts`, the health check loops check `http://127.0.0.1:54321` every 2 seconds (`await new Promise(resolve => setTimeout(resolve, 2000))`). When Supabase is unresponsive, at retries 15, 10, and 5, the script executes the teardown block and invokes `npx supabase start --ignore-health-check`. Because Supabase takes >10s to boot, 5 retries elapse in 10 seconds, causing the loop to trigger the next restart threshold (retry 10 after retry 15) while `npx supabase start` is still initializing containers in the background. This causes container thrashing (`TypeError: fetch failed`) and cascading teardown collisions (`supabase start is already running.`), corrupting the database state (`Database error finding users`).
- **Mitigation Recommended by Reviewer 1 & Challenger 1**: Increase the health check polling interval (e.g., `5000` ms instead of `2000` ms) or add a longer `sleep` (e.g., `sleep 15` or `sleep 20`) after `npx supabase start` within the recovery blocks to ensure Supabase fully initializes before the loop resumes checking.

#### Reviewer 2 & Challenger 2 (Iter 18) Findings
- **Teardown Race Condition & Split-Brain Container State**: The standardized teardown sequence in `e2e/run_e2e.ts` executes `pkill -9 -f "supabase"` BEFORE `npx supabase stop --no-backup`. When `pkill -9 -f "supabase"` kills the Supabase CLI process while it is actively spinning up Docker containers, the Docker daemon continues starting containers asynchronously in the background. When `docker ps -aq | xargs -r docker rm -f` and `while docker ps -aq | grep -q . ...` run, they see an empty container list at that exact millisecond and exit immediately. A second later, the Docker daemon finishes starting the remaining containers and writes `supabase/.temp/status.json`. Consequently, when `npx supabase start --ignore-health-check` runs, it sees `status.json`, prints `supabase start is already running`, and exits immediately with 0 without starting the database container or running migrations. This results in `relation "public.expenses" does not exist` during `init_db.ts`.
- **Unprotected `cleanup()` Teardown**: Worker 1 omitted `cleanup()`, which still uses the legacy teardown sequence (`npx supabase stop` followed immediately by `docker volume rm -f`), causing `a prune operation is already running` errors.
- **Mitigation Recommended by Reviewer 2 & Challenger 2**: Reorder the teardown sequence so that `npx supabase stop --no-backup` and Docker container/volume removal occur BEFORE `pkill -9 -f "supabase"`. Specifically, ensure `rm -rf supabase/.temp` is executed at the very end of the teardown block so that no lingering `status.json` file can cause `npx supabase start` to abort. Ensure `cleanup()` also uses the exact standardized teardown sequence.

### Objective
Your objective is to investigate `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, and the codebase, analyze the root causes of `LegacyDbConnectError: failed to connect to postgres`, `supabase_pooler_expense-dashboard container is not running: exited`, `supabase start is already running`, `relation "public.expenses" does not exist`, `a prune operation is already running`, and `TypeError: fetch failed`, and recommend a concrete, bulletproof fix strategy.
1. Inspect `e2e/run_e2e.ts`. Note how `pkill -9 -f supabase` before `npx supabase stop` caused the Docker daemon race condition, how `cleanup()` was omitted, how 2s polling caused cascading restart collisions at retries 15, 10, and 5, and how polling `http://127.0.0.1:54321` ignored underlying Postgres database container initialization delays/crashes.
2. Formulate the exact code changes to `e2e/run_e2e.ts` to implement a reordered, bulletproof teardown sequence across ALL SEVEN locations (`setup()` initial cleanup, `setup()` loop start, `setup()` loop catch block, `run()` health check recovery, `run()` pre-seed health check recovery, `run()` post-build health check recovery, AND `cleanup()`) that:
   - Stops Supabase FIRST (`npx supabase stop --no-backup 2>/dev/null || true`).
   - Removes containers (`docker ps -aq | xargs -r docker rm -f 2>/dev/null || true`).
   - Includes a robust Docker prune lock wait loop (`while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done`).
   - Removes volumes (`docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`).
   - Kills all `supabase`, `supabase-go`, and `npx supabase` processes AFTER Docker cleanup (`pkill -9 -f "supabase" 2>/dev/null || true`, `pkill -9 -f "supabase-go" 2>/dev/null || true`, `pkill -9 -f "npx supabase" 2>/dev/null || true`).
   - Kills ports (`fuser -k 25432/tcp 54329/tcp 2>/dev/null || true`).
   - Removes `supabase/.temp` AT THE VERY END (`rm -rf supabase/.temp 2>/dev/null || true`).
   - Retains a dedicated `sleep 20` buffer.
3. Formulate the exact code changes to `e2e/run_e2e.ts` to increase the health check polling interval from `2000` ms to `5000` ms (`await new Promise(resolve => setTimeout(resolve, 5000))`) across all health check loops, and add a post-start stabilization delay (`sleep 20`) after `npx supabase start --ignore-health-check` in all recovery blocks to eliminate cascading restart collisions.
4. Formulate the exact code changes to `e2e/run_e2e.ts` to explicitly verify Postgres database readiness at port `25432` using `pg.Client` (in addition to `http://127.0.0.1:54321`) before proceeding to `npx supabase migration up --include-all`. If `npx supabase migration up` fails, update the catch block to perform a full `npx supabase stop` and `npx supabase start` rather than relying on `npx supabase db reset`.
5. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
6. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
7. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
8. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
9. Ensure `e2e/seed.ts` retains robust retry loops around data deletion and user creation/deletion, `schemaRetries = 50`, and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
10. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
11. Ensure `next.config.js` retains `outputFileTracing: false`.
12. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

When complete, write `handoff.md` in your working directory and send a completion message to me.
