# Scope: Worker Gen 2 (Iteration 3 Remediation Implementation)

## Objective
Implement the synthesized fix strategy for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.
Specifically, remediate the two regressions introduced by Worker Gen 1 in `e2e/run_e2e.ts`: remove `--ignore-health-check` from `npx supabase start` and restore `sleep 20` in the teardown sequences.

## Reference Documents
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Handoff Synthesis: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`
