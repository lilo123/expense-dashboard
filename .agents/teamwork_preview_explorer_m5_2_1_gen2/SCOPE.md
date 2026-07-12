# Scope: Explorer 1 Gen 2 (Iteration 2 Investigation & Remediation)

## Objective
Investigate the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard` for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 2.
Focus on remediating the integrity violations identified by the Forensic Auditor (`e2e/adv_planner_gaps.ts` self-certifying test, `e2e/verify_accumulation.ts` hardcoded assert, `src/lib/planner/simulator.ts` hardcoded PRNG seed, and `e2e/run_e2e.ts` seeding timeouts).

## Reference Documents
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Forensic Auditor Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_2_1/handoff.md`
