# Plan: M5.2 Tier 2 E2E Test Gate Failure Investigation & Fix Strategy

## Objective
Investigate the gate failure in Iteration 8 for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) and formulate a bulletproof fix strategy for Worker Gen 12.

## Step-by-Step Plan

1. **Information Gathering & File Inspection**
   - [ ] Inspect previous handoff reports in `.agents/worker_m5_2_1_gen11/`, `.agents/reviewer_m5_2_1_1_gen7/`, `.agents/reviewer_m5_2_1_2_gen7/`, `.agents/challenger_m5_2_1_1_gen7/`, `.agents/challenger_m5_2_1_2_gen7/`, `.agents/auditor_m5_2_1_gen7/`.
   - [ ] Inspect `e2e/run_e2e.ts` to understand the current `acquireLock()`, Supabase startup logic, OOM protection, and test execution flow.
   - [ ] Inspect `__tests__/db/recurring_db.test.ts` to understand its Supabase startup logic and test execution flow.
   - [ ] Inspect `supabase/config.toml` to verify its current state.

2. **Analysis & Fix Strategy Formulation**
   - [ ] **Dynamic `supabase/config.toml` Maintenance**: Design a robust check-and-append mechanism in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to ensure `health_timeout = "10m"` is present under `[db]` before starting Supabase.
   - [ ] **Pre-populated Artifact Cleanup**: Design explicit pre-execution cleanup (`rm -rf test-results playwright-report`) in both files.
   - [ ] **Queue Backlog & False Positive PID Pruning**: Enhance `acquireLock()` in `e2e/run_e2e.ts` to verify active PIDs via `ps -p ${pid} -o args= 2>/dev/null` checking for `run_e2e` or `tsx`, pruning false positives immediately.
   - [ ] **OOM Protection for Full Ancestor Tree**: Enhance OOM protection in `e2e/run_e2e.ts` to traverse all parent PIDs up to PID 1 and apply `echo -1000 > /proc/${pid}/oom_score_adj`.

3. **Reporting & Handoff**
   - [ ] Update `progress.md` at each step.
   - [ ] Draft `handoff.md` following the 5-Component Handoff Report protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method) with precise line-by-line replacement instructions for Worker Gen 12.
   - [ ] Send completion message to parent agent via `send_message`.
