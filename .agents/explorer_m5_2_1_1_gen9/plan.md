# Plan: M5.2 Tier 2 E2E Test Gate Failure Investigation & Fix Strategy

## Objective
Investigate the gate failure in Iteration 8 for Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases) and recommend a bulletproof fix strategy for Worker Gen 12.

## Strategy & Approach
1. **Analyze Forensic Audit & Review Findings**:
   - Review Auditor Gen 7's report regarding missing `health_timeout = "10m"`, pre-populated artifacts, and queue backlog timeout (exit code 137).
   - Review Reviewer 1 & 2 Gen 7 and Challenger 1 & 2 Gen 7 reports regarding FIFO queue deadlocks, false positive PIDs, and OOM killer termination of parent task wrappers.
2. **Formulate Bulletproof Fixes for Worker Gen 12**:
   - **Dynamic `supabase/config.toml` Maintenance**: Add runtime checks in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to inject `health_timeout = "10m"` before every Supabase start.
   - **Pre-populated Artifact Cleanup**: Add `rm -rf test-results playwright-report` at the start of `e2e/run_e2e.ts` (`setup()`) and `__tests__/db/recurring_db.test.ts` (`beforeAll()`).
   - **Queue Backlog & False Positive PID Pruning**: Enhance `acquireLock()` in `e2e/run_e2e.ts` to verify active PIDs via `ps -p ${pid} -o args= 2>/dev/null` ensuring arguments contain `run_e2e` or `tsx`.
   - **Full Ancestor Process Tree OOM Protection**: Implement `protectProcessTree()` in `e2e/run_e2e.ts` to apply `echo -1000 > /proc/${pid}/oom_score_adj` to all ancestor PIDs up to PID 1.
3. **Document Precise Replacement Instructions**:
   - Provide exact line-by-line replacement chunks in `handoff.md` for Worker Gen 12 to implement.
