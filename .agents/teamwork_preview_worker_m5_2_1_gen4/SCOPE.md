# Scope: Worker Gen 4 (Iteration 5 Remediation Implementation)

## Objective
Implement the synthesized fix strategy for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 5 for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.
Specifically, refactor `e2e/run_e2e.ts` to remove `docker network prune -f`, `rm -rf $HOME/.supabase`, `--ignore-health-check`, and the inner retry loop, while increasing `checkRetries` to 120. Also refactor `__tests__/db/recurring_db.test.ts` to implement a graceful mock fallback during standalone `npm test` execution when Supabase Postgres is unreachable.

## Reference Documents
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Handoff Synthesis: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`
