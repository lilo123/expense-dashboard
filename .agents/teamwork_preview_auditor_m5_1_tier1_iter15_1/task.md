# Task: Forensic Auditor M5.1 Tier 1 E2E Test Forensic Audit (Iteration 15)
Perform forensic integrity verification and test coverage audit of Worker 1's implementation in Iteration 15.
1. Perform forensic integrity verification to ensure no cheating, hardcoded test results, error swallowing try...catch blocks, or dummy/facade implementations exist.
2. Verify that `e2e/run_e2e.ts` correctly converts `setup()` to `async`, includes robust HTTP reachability verification (`await fetch('http://127.0.0.1:54321')`), removes manual `docker network create/rm` and `fuser -k 54321/tcp`, and wraps every `execSync` in individual `try...catch` blocks.
3. Verify that `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and no `pkill -9 -f next` or `try...catch` around `init_db.ts` or Playwright test execution.
4. Verify that `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
5. Verify that `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
6. Verify that `next.config.js` retains `outputFileTracing: false`.
7. Verify that `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
8. Run the full test runner command specified in `TEST_READY.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true && npx tsc --noEmit && npm run test __tests__/planner && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`

⚠️ HARD VETO — NON-NEGOTIABLE: If you detect any INTEGRITY VIOLATION or CHEATING DETECTED, report it immediately.
