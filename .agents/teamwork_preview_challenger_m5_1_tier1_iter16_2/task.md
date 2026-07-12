# Task: Challenger 2 M5.1 Tier 1 E2E Test Stress Testing (Iteration 16)
Empirically verify correctness and stress test Worker 1's implementation in Iteration 16.
1. Inspect `e2e/run_e2e.ts` to verify the exact `while docker ps -aq | grep -q .; do sleep 2; done` synchronous waiting loop is present in all six teardown locations immediately after `docker rm -f` and before `docker volume rm -f`.
2. Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
3. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
4. Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
5. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
6. Ensure `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
7. Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
8. Ensure `next.config.js` retains `outputFileTracing: false`.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
10. Execute the prerequisite process cleanup command to terminate all orphaned test runners, fully prune all containers, and purge all volumes:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`
11. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
12. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
13. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
14. Document your stress test results in `handoff.md` in your working directory, and send a completion message to me.
