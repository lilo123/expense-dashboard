# Scope: Explorer 1 Gen 4 (Iteration 4 Investigation & Remediation)

## Objective
Investigate the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard` for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 4.
Focus on remediating the Supabase container conflicts (`Conflict. The container name "/supabase_db_expense-dashboard" is already in use`), Docker daemon race conditions (`removal of container ... is already in progress`), and Supabase CLI lock contention (`supabase start is already running`) in `e2e/run_e2e.ts`.

## Reference Documents
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Forensic Auditor Gen 2 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_2_1_gen2/handoff.md`
- Challenger 1 Gen 2 Handoff Report: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m5_2_1_gen2/handoff.md`
