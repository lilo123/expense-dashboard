# Investigation Plan: M5.2 Tier 2 E2E Test Gate Failure Investigation

## Goal
Investigate the gate failure in Iteration 8 for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) and recommend a bulletproof fix strategy for Worker Gen 12.

## Objectives & Success Criteria
1. **Understand Previous Iteration State**: Read handoff reports from Worker Gen 11, Reviewer Gen 7 (1 & 2), Challenger Gen 7 (1 & 2), and Auditor Gen 7.
2. **Analyze Target Files**: Inspect `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, and `supabase/config.toml` to understand how Supabase is started, how locks are acquired, and how test artifacts are handled.
3. **Formulate Bulletproof Fix Strategy**:
   - **Dynamic `supabase/config.toml` Maintenance**: Ensure `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` dynamically check and append `health_timeout = "10m"` to `supabase/config.toml` before every Supabase start.
   - **Pre-populated Artifact Cleanup**: Ensure `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` explicitly remove pre-existing test artifacts (`rm -rf test-results playwright-report`) before executing tests.
   - **Queue Backlog & False Positive PID Pruning**: Ensure `acquireLock()` verifies active PIDs by checking `ps -p ${pid} -o args= 2>/dev/null` to ensure the arguments contain `run_e2e` or `tsx`. If not, prune the false positive PID from the queue immediately.
4. **Deliver Handoff Report**: Provide `handoff.md` with precise, line-by-line replacement instructions for Worker Gen 12.

## Planned Steps
1. [ ] Read previous handoff reports (`worker_m5_2_1_gen11`, `reviewer_m5_2_1_1_gen7`, `reviewer_m5_2_1_2_gen7`, `challenger_m5_2_1_1_gen7`, `challenger_m5_2_1_2_gen7`).
2. [ ] Inspect `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, and `supabase/config.toml`.
3. [ ] Formulate precise line-by-line replacement instructions for Worker Gen 12.
4. [ ] Write `handoff.md` following the 5-component handoff protocol.
5. [ ] Update `progress.md` and `BRIEFING.md`.
6. [ ] Send completion message to parent agent.
