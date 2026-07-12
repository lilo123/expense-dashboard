# Investigation Plan: M5.2 Tier 2 E2E Test Pass (Iteration 7 Gate Failure)

## Objectives
1. Investigate the missing `health_timeout = "10m"` under `[db]` in `supabase/config.toml`.
2. Analyze `e2e/run_e2e.ts` to understand mutex lock contention, starvation, and premature termination flaws (`killLingeringProcessesScoped`, `teardownSupabase`).
3. Formulate a bulletproof fix strategy for Worker Gen 11 with precise line-by-line replacement instructions.

## Planned Steps
1. **Read Previous Handoff Reports**:
   - `.agents/worker_m5_2_1_gen10/handoff.md`
   - `.agents/reviewer_m5_2_1_1_gen6/handoff.md`
   - `.agents/reviewer_m5_2_1_2_gen6/handoff.md`
   - `.agents/challenger_m5_2_1_1_gen6/handoff.md`
   - `.agents/challenger_m5_2_1_2_gen6/handoff.md`
   - `.agents/auditor_m5_2_1_gen6/handoff.md`
2. **Inspect Target Files**:
   - `supabase/config.toml`: Check `[db]` section and verify missing `health_timeout`.
   - `e2e/run_e2e.ts`: Examine lock acquisition logic, timeouts, cleanup routines (`killLingeringProcessesScoped`, `teardownSupabase`), and process filtering.
3. **Synthesize Findings**:
   - Reconcile claims from Worker Gen 10 with findings from Reviewers and Challengers.
   - Design robust solutions for Supabase config and `run_e2e.ts` concurrency.
4. **Draft Handoff Report**:
   - Prepare `handoff.md` following the 5-component structure (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
   - Provide exact line-by-line replacement instructions for Worker Gen 11.
5. **Finalize and Notify**:
   - Update `progress.md` and `BRIEFING.md`.
   - Send completion message to parent orchestrator.
