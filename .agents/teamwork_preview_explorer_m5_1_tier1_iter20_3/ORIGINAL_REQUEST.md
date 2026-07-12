## 2026-07-07T00:45:20Z

You are Explorer 3 (Iteration 20) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter20_3`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, and `.agents/ORIGINAL_REQUEST.md`.

### VERIFICATION FAILURE (Iteration 19)
The previous iteration failed during independent verification where the E2E test runner (`npx tsx e2e/run_e2e.ts`) failed with exit code 1 due to a critical deadlock uncovered by Challenger 1 (`c430e51a-0922-4477-b8ac-220bd55eba46`).
You MUST analyze the failure and recommend a concrete fix strategy that addresses this specific issue. Do NOT implement the fix yourself.

#### Challenger 1 (Iter 19) Findings
- **Critical Deadlock in `e2e/run_e2e.ts`**: When `npx supabase start` fails or during teardown blocks, the script executes `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done` BEFORE `docker volume ls -q | xargs -r docker volume rm -f`. If a Supabase Docker volume exists (e.g., `expense-dashboard_supabase_db_expense-dashboard`), `docker volume ls -q | grep -q "supabase"` evaluates to true (`0`). Because the volume removal command (`docker volume rm -f`) is placed AFTER the `while` loop, the volume is never removed while the loop is running! Thus, the `while` loop hangs infinitely (`while true; do sleep 2; done`), permanently deadlocking the E2E test runner!
- **Mitigation Recommended by Challenger 1**: Correct the ordering of the volume removal and `while` loop in `e2e/run_e2e.ts`. Specifically, execute `docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` BEFORE the `while` loop, or adjust the `while` loop so it doesn't deadlock on existing volumes.

### Objective
Your objective is to investigate `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, and the codebase, analyze the root cause of the infinite `while` loop deadlock, and recommend a concrete, bulletproof fix strategy.
1. Inspect `e2e/run_e2e.ts`. Note how `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done` before `docker volume ls -q | xargs -r docker volume rm -f` caused the infinite hang when a Supabase volume exists.
2. Formulate the exact code changes to `e2e/run_e2e.ts` to implement a corrected, bulletproof teardown sequence across ALL EIGHT locations (`setup()` initial cleanup, `setup()` loop start, `setup()` loop catch block, `cleanup()`, `run()` health check recovery, `run()` db push recovery, `run()` pre-seed health check recovery, `run()` post-build health check recovery) that:
   - Stops Supabase FIRST (`npx supabase stop --no-backup 2>/dev/null || true`).
   - Removes containers (`docker ps -aq | xargs -r docker rm -f 2>/dev/null || true`).
   - Removes volumes BEFORE the `while` loop (`docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`).
   - Includes the robust Docker prune lock wait loop AFTER volume removal (`while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done`).
   - Kills all `supabase`, `supabase-go`, and `npx supabase` processes AFTER Docker cleanup (`pkill -9 -f "supabase" 2>/dev/null || true`, `pkill -9 -f "supabase-go" 2>/dev/null || true`, `pkill -9 -f "npx supabase" 2>/dev/null || true`).
   - Kills ports (`fuser -k 25432/tcp 54329/tcp 2>/dev/null || true`).
   - Removes `supabase/.temp` AT THE VERY END (`rm -rf supabase/.temp 2>/dev/null || true`).
   - Retains a dedicated `sleep 20` buffer.
3. Ensure `e2e/run_e2e.ts` retains `5000` ms polling intervals (`await new Promise(resolve => setTimeout(resolve, 5000))`) across all health check loops, post-start stabilization delays (`sleep 20`) after `npx supabase start --ignore-health-check` in all recovery blocks, explicit `pg.Client` Postgres database readiness verification at port `25432`, and full stop/start recovery on migration failure.
4. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
5. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
6. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
7. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
8. Ensure `e2e/seed.ts` retains robust retry loops around data deletion and user creation/deletion, `schemaRetries = 50`, and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
9. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
10. Ensure `next.config.js` retains `outputFileTracing: false`.
11. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

When complete, write `handoff.md` in your working directory and send a completion message to me.
