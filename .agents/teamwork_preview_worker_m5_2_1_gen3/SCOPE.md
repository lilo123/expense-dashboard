# Scope: Worker Gen 3 (Iteration 4 Remediation Implementation)

## Objective
Implement the synthesized fix strategy for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) in Iteration 4 for the Next.js retirement calculator expansion at `/usr/local/google/home/duynguyenn/expense-dashboard`.
Specifically, refactor `e2e/run_e2e.ts` to use a unified, idempotent `teardownSupabase()` helper function that eliminates redundant cleanup race conditions and removes orphaned Supabase CLI lock files (`~/.supabase/supabase.lock`, `/tmp/supabase.lock`).

## Reference Documents
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- TEST_READY.md: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/SCOPE.md`
- Handoff Synthesis: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_2/handoff_synthesis.md`
