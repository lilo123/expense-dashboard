# Plan — Milestone 5.2 (Worker Gen 10)

## Goal
Achieve Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) with 100% genuine test pass and exit code 0.

## Step-by-Step Plan
1. **Understand & Validate Requirements**
   - Read `task.md`, `handoff_synthesis.md`, `SCOPE.md`, `PROJECT.md`, `TEST_READY.md`.
   - Inspect `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` to ensure they perfectly match `handoff_synthesis.md`.
2. **Deep Clean Teardown**
   - Execute `pkill -9 -f node`, `pkill -9 -f playwright`, `pkill -9 -f supabase`, `docker ps -aq | xargs -r docker rm -f`, etc.
3. **Investigate Playwright Test Failure**
   - Run `npx playwright test` directly or inspect previous logs/test results to identify root causes (dev server, cookie rejection, CSP issues, OOM kill).
4. **Implement Necessary Fixes**
   - Fix host-only cookies in `@supabase/ssr`.
   - Fix CSP `upgrade-insecure-requests` in `src/proxy.ts`.
   - Fix OOM kill prevention in `e2e/run_e2e.ts`.
5. **Execute Full Verification Chain**
   - Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`.
6. **Final Handoff**
   - Update `progress.md` and `BRIEFING.md`.
   - Generate `handoff.md` and send message to parent agent.
