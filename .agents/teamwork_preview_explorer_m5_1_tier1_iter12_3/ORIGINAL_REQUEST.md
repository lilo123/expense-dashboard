## 2026-07-06T19:40:52Z

You are Explorer 3 (Iteration 12) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter12_3`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, and `.agents/ORIGINAL_REQUEST.md`.

### VERIFICATION SWARM FINDINGS & VETOES (Iteration 11)
In Iteration 11, Reviewer 1, Reviewer 2, and the Forensic Auditor confirmed that all domain logic engines (`types.ts`, `drawdownEngine.ts`, `simulator.ts`, `config.toml`), Zod schemas, Supabase rate limits, unit tests, `outputFileTracing: false`, `NODE_OPTIONS` sanitization, lingering `run_e2e` process cleanup, and E2E tests are genuinely and correctly implemented with zero cheating or integrity violations (Verdict: CLEAN / APPROVE).
However, Challenger 1 and the Forensic Auditor uncovered two critical Supabase container and PostgREST schema cache race conditions that cause `e2e/run_e2e.ts` to fail during independent verification:

#### 1. Challenger 2 (Iter 11) Findings (PASSED via Volume Purge)
Initial execution of `e2e/run_e2e.ts` encountered `connect ECONNREFUSED 127.0.0.1:54321` during `e2e/seed.ts` due to corrupted lingering Supabase Docker volumes (`expense-dashboard_supabase_db_expense-dashboard`).
**Mitigation**: After executing `docker volume ls -q | xargs -r docker volume rm -f` to purge the corrupted volumes, the full E2E test runner command completed successfully with exit code 0.

#### 2. Challenger 1 & Forensic Auditor (Iter 11) Findings (FAILED / Race Condition)
`e2e/init_db.ts` connects directly to Postgres on port 25432 to grant permissions to `anon`, `authenticated`, and `service_role`, and sends `NOTIFY pgrst, 'reload schema';`. However, because the Supabase Kong/PostgREST container (port 54321) was restarting or hadn't fully processed the notification, PostgREST retained a stale schema cache. When `e2e/seed.ts` attempted to upsert profiles and fetch categories via the Supabase JS client (which calls PostgREST on port 54321), PostgREST rejected the requests with `permission denied for table profiles` and `permission denied for table categories`.
**Mitigation**: Update `e2e/seed.ts` (and/or `e2e/run_e2e.ts`) with a robust retry loop verifying PostgREST schema cache readiness (e.g., polling `supabase.from('profiles').select('*').limit(1)` or `supabase.from('categories').select('*').limit(1)` until it no longer returns `permission denied`, or explicitly waiting/retrying until PostgREST has fully reloaded its schema cache) before attempting profile upserts or category fetching.

### Objective
Your objective is to investigate `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, and the codebase, analyze the root causes of these Supabase container flakiness and PostgREST schema cache desynchronization issues, and recommend a concrete, bulletproof fix strategy.
1. Recommend the exact code changes to `e2e/run_e2e.ts` to add `docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true` to the prerequisite cleanup in `setup()` and `cleanup()`, ensuring Supabase CLI recreates a fresh, uncorrupted database volume on every run.
2. Recommend the exact code changes to `e2e/seed.ts` (and/or `e2e/run_e2e.ts`) to implement a robust retry loop that verifies PostgREST schema cache readiness (e.g., polling `supabase.from('profiles').select('*').limit(1)` and `supabase.from('categories').select('*').limit(1)` until they succeed without `permission denied` errors) before executing any profile upserts or category fetching.
3. Ensure `next.config.js` retains `outputFileTracing: false`.
4. Ensure `e2e/run_e2e.ts` retains `NODE_OPTIONS: ''` sanitization in `execSync('npm run build', ...)`, lingering `run_e2e` process cleanup (`pgrep -f run_e2e`), and the removal of `suppress_crashes.js`.
5. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
6. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
7. Ensure `e2e/run_e2e.ts` retains `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
8. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

When complete, write `handoff.md` in your working directory and send a completion message to me.
