# Verification Plan: M5.2 Tier 2 E2E Test Pass (Challenger 2 Gen 7)

## Objectives
Empirically verify Worker Gen 11's implementation for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases) and ensure 100% genuine test pass with exit code 0, 0 lint errors, and complete robustness against container conflicts, lock timeouts, and OOM kills.

## Step-by-Step Plan

### Phase 1: Code Inspection & Verification of Worker Gen 11's Changes
1. Inspect `__tests__/db/recurring_db.test.ts` to verify Supabase teardown/startup logic, `--debug` flags, and `SUPABASE_DAEMON_ENABLE: 'false'`.
2. Inspect `e2e/run_e2e.ts` to verify fair FIFO queue mutex lock (`/tmp/run_e2e.queue`), 2-hour timeout (`1440` attempts), dynamic `protectedPids` tree filtering, and `ps auxww`.
3. Inspect `src/proxy.ts` to verify any changes made by Worker Gen 11.
4. Inspect `supabase/config.toml` to verify `health_timeout = "10m"` is present under `[db]` and has not been removed externally.

### Phase 2: Full Verification Chain Execution
1. Execute the full verification chain exactly as instructed:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run lint && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
   ```
2. Verify that every single command completes successfully with exit code 0 and `npm run lint` completes with 0 errors.

### Phase 3: Stress-Testing & Concurrency Robustness Verification
1. Perform stress testing on `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to ensure no container conflicts, lock timeouts, or OOM kills occur under repeated/concurrent invocations.
2. Verify that `supabase/config.toml` remains intact and retains `health_timeout = "10m"` throughout stress testing.

### Phase 4: Reporting & Handoff
1. Update `progress.md` with final status.
2. Generate `handoff.md` following the 5-component Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
3. Send confirmation of correctness via `send_message` to parent agent.
