# Task: M5.2 Tier 2 E2E Test Pass (Worker Gen 10)

## Objectives
1. Take over from Worker Gen 9 to successfully pass 100% of Tier 2 E2E tests (Boundary & Corner Cases) defined in `TEST_READY.md`.
2. Ensure `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` perfectly match the requirements in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`.
3. Perform a deep clean teardown (`pkill -9 -f node`, `pkill -9 -f playwright`, `pkill -9 -f supabase`, `docker ps -aq | xargs -r docker rm -f`, etc.).
4. Investigate the Playwright test failure in `e2e/run_e2e.ts` (`npx playwright test`) to identify the root cause (e.g., missing dev server, cookie rejection, CSP issues, or OOM kill).
5. Implement necessary fixes (e.g., host-only cookies in `@supabase/ssr`, CSP `upgrade-insecure-requests` fix in `src/proxy.ts`, OOM kill prevention in `e2e/run_e2e.ts`).
6. Execute the full verification chain command-by-command to ensure 100% of tests pass genuinely with exit code 0.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification Chain
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```

## Deliverables
- Maintain `plan.md` and `progress.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/worker_m5_2_1_gen10`.
- Provide `handoff.md` upon successful verification and send a completion message to the sub-orchestrator.
