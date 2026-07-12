# Verification Plan: Tier 3 E2E Challenger 1 (Iteration 6, Gen 2)

## Phase 1: Investigation & Code Inspection
1. Read Worker 1 Gen 2's handoff report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_3_tier3_iter6_1_gen2/handoff.md`).
2. Inspect `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `supabase/config.toml`, and `e2e/run_e2e.ts`.
3. Analyze the implementation of `acquireLock()`, `teardownSupabase()`, and the test runner commands in `TEST_READY.md`.

## Phase 2: Empirical Verification (Master E2E Test Runner)
1. Execute the master E2E test runner command defined in `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
2. Verify that all tests pass with exit code 0.

## Phase 3: Stress-Testing & Adversarial Challenge
1. **Stale Mutex Lock Challenge**: Create a simulated stale lock file (`/tmp/supabase_e2e.lock` or wherever `acquireLock()` stores it) containing a PID of a dead process (or a running process that is not supabase/test runner) and verify `acquireLock()` correctly identifies it as stale using `process.kill(pid, 0)` and overwrites/acquires the lock.
2. **Daemon Corruption / Teardown Challenge**: Verify `teardownSupabase()` cleans up all spawned Supabase CLI / Docker daemon processes properly and does not leave orphaned daemons or corrupt state even when invoked repeatedly or under error conditions.
3. **Exit Code Propagation Challenge**: Verify `TEST_READY.md` chain (`&&`) and `run_e2e.ts` correctly propagate non-zero exit codes when a child test fails, ensuring no masked failures.

## Phase 4: Reporting & Handoff
1. Update `BRIEFING.md` and `progress.md`.
2. Write `handoff.md` following the 5-component Handoff Protocol.
3. Send completion message to parent (`fbb8e945-2a98-4e23-89f2-f6529a71f015`).
