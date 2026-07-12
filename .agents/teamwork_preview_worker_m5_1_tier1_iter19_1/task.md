# Task: Worker 1 M5.1 Tier 1 E2E Test Fix Implementation (Iteration 19)
Implement the exact fix strategy recommended by the Explorers in Iteration 19 to resolve `LegacyDbConnectError: failed to connect to postgres`, `supabase_pooler_expense-dashboard container is not running: exited`, `supabase start is already running`, `relation "public.expenses" does not exist`, `a prune operation is already running`, and `TypeError: fetch failed`.

### MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Implementation Instructions
1. Replace `e2e/run_e2e.ts` with the exact contents of `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter19_3/proposed_run_e2e.ts`.
2. Verify `e2e/run_e2e.ts` contains the reordered bulletproof teardown sequence across all seven locations (`npx supabase stop`, `docker rm -f`, `while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase"; do sleep 2; done`, `docker volume rm -f`, `pkill -9 -f supabase`, `fuser -k`, `rm -rf supabase/.temp` AT THE VERY END, `sleep 20`), 5000ms polling intervals, 20s stabilization delays, explicit `pg.Client` Postgres database readiness verification at port 25432, and full stop/start recovery on migration failure.
3. Verify `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, `async setup()`, and no `pkill -9 -f next`, `fuser -k 54321/tcp`, or `try...catch` around `init_db.ts` or Playwright test execution.
4. Verify `e2e/seed.ts` retains robust retry loops around data deletion and user creation/deletion, `schemaRetries = 50`, and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
5. Verify `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
6. Verify `next.config.js` retains `outputFileTracing: false`.
7. Verify `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
8. Run prerequisite cleanups: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`.
9. Run TypeScript compilation check: `npx tsc --noEmit`.
10. Run unit tests: `npm run test __tests__/planner`.
11. Run the full E2E test runner command: `npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`. Ensure all tests pass successfully with exit code 0.

When complete, write `handoff.md` in your working directory and send a completion message to me.
