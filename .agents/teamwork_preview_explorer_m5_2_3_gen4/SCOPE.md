# Scope: Explorer 3 Gen 4 (Iteration 5 Investigation & Remediation)

## Objective
Investigate the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard` for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 5.
Focus on remediating the Supabase container initialization timeout (`checkRetries = 30`) in `e2e/run_e2e.ts` and the standalone `npm test` failure (`connect ECONNREFUSED 127.0.0.1:25432`) in `__tests__/db/recurring_db.test.ts`.

## Reference Documents
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Forensic Auditor Gen 3 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_2_1_gen3/handoff.md`
- Reviewer 1 Gen 3 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_2_1_gen3/handoff.md`
