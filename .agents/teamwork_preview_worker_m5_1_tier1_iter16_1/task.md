# Task: Worker 1 M5.1 Tier 1 E2E Test Fix Implementation (Iteration 16)
Implement the exact fix strategy formulated by the Explorers in Iteration 16 to resolve Supabase startup instability (`Unknown: ChildProcess.exitCode`, `supabase start is already running`, `unexpected EOF`) and Docker daemon container removal race conditions (`removal of container ... is already in progress`, `a prune operation is already running`) in `e2e/run_e2e.ts`.
1. Update `e2e/run_e2e.ts` to insert `try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}` into all six teardown blocks immediately after `docker rm -f` and before `docker volume rm -f`.
2. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
3. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
4. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
5. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
6. Ensure `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
7. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
8. Ensure `next.config.js` retains `outputFileTracing: false`.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
10. Verify TypeScript compilation (`npx tsc --noEmit`), unit tests (`npm run test __tests__/planner`), and full E2E test runner command (`npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`).
