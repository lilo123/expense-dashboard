# Task: M5.2 Tier 2 E2E Test Pass — Explorer 3 Gen 7

## Objectives
1. Investigate the gate failure in Iteration 7 for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) and recommend a bulletproof fix strategy.
2. Read `task.md` in your working directory, as well as `PROJECT.md`, `TEST_READY.md`, `SCOPE.md`, and the previous handoff reports in `.agents/worker_m5_2_1_gen10/`, `reviewer_m5_2_1_1_gen6/`, `reviewer_m5_2_1_2_gen6/`, `challenger_m5_2_1_1_gen6/`, `challenger_m5_2_1_2_gen6/`, `auditor_m5_2_1_gen6/`.
3. Inspect `supabase/config.toml` to verify the missing `health_timeout = "10m"` setting under `[db]`.
4. Inspect `e2e/run_e2e.ts` to analyze the mutex lock contention, starvation, and premature termination flaws.
5. Formulate a bulletproof fix strategy for Worker Gen 11 that:
   - Successfully adds `health_timeout = "10m"` under `[db]` in `supabase/config.toml`.
   - Hardens `e2e/run_e2e.ts` against mutex lock starvation and premature termination (e.g., implementing an aggressive lock acquisition retry loop with longer timeouts, ensuring cleanup routines strictly filter out waiting `run_e2e` instances, or using a more robust IPC/file lock mechanism).

## Deliverables
- Maintain `plan.md` and `progress.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/explorer_m5_2_1_3_gen7`.
- Provide `handoff.md` with your investigation report and precise, line-by-line replacement instructions for Worker Gen 11, and send a completion message to the sub-orchestrator via `send_message`.
