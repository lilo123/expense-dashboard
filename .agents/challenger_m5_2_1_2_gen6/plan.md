# Verification Plan — M5.2 Tier 2 E2E Test Pass

## Objectives
Empirically verify Worker Gen 10's changes (`__tests__/db/recurring_db.test.ts`, `e2e/run_e2e.ts`, `src/proxy.ts`, `supabase/config.toml`) and stress-test the implementation to ensure 100% of tests pass genuinely with exit code 0, without container conflicts, lock timeouts, or OOM kills.

## Step-by-Step Plan

### 1. Code Inspection & Verification Setup
- Inspect Worker Gen 10's modified files (`__tests__/db/recurring_db.test.ts`, `e2e/run_e2e.ts`, `src/proxy.ts`, `supabase/config.toml`).
- Verify the changes align with the claims in Worker Gen 10's handoff report (CSP fix, Supabase health timeout, Supabase teardown restoration, OOM kill prevention, mutex contention management).

### 2. Full Verification Chain Execution
- Execute the full verification chain as specified:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
  ```
- Verify all test suites pass with exit code 0.

### 3. Stress-Testing & Robustness Verification
- Perform stress testing to ensure no container conflicts, lock timeouts, or OOM kills occur under repeated or stressful conditions.
- Specifically verify the OOM adjustment (`echo -1000 > /proc/${process.pid}/oom_score_adj`), memory limits (`--max-old-space-size=512`), and Supabase container teardown robustness.
- Verify `npm run lint` completes with 0 errors.

### 4. Reporting & Handoff
- Update `BRIEFING.md` and `progress.md`.
- Generate `handoff.md` following the 5-Component Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send confirmation message to parent agent.
