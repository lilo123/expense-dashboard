# Verification Plan — M5.2 Tier 2 E2E Test Pass (Challenger 1 Gen 6)

## Objective
Empirically verify Worker Gen 10's implementation for Milestone 5.2 (M5.2: Tier 2 E2E Test Pass - Boundary & Corner Cases). Ensure 100% of tests pass genuinely with exit code 0 and stress-test against container conflicts, lock timeouts, or OOM kills.

## Step-by-Step Plan

### 1. Code Inspection & Verification of Fixes
- Inspect `__tests__/db/recurring_db.test.ts`, `e2e/run_e2e.ts`, `src/proxy.ts`, `supabase/config.toml`.
- Verify the CSP fix in `src/proxy.ts` (handling localhost/127.0.0.1/[::1] correctly).
- Verify Supabase container health timeout in `supabase/config.toml` (`health_timeout = "10m"`).
- Verify Supabase teardown and mutex handling in `e2e/run_e2e.ts`.
- Verify OOM prevention measures (`oom_score_adj`, `--max-old-space-size=512`).

### 2. Empirical Test Execution (Full Verification Chain)
- Execute the full verification chain:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
  ```
- Monitor for exit code 0, OOM kills (137), lock timeouts, or container readiness issues.

### 3. Stress-Testing & Robustness Check
- Review test execution logs to ensure tests did not skip or exit prematurely.
- Verify that no lingering Supabase containers or lock files remain after execution.

### 4. Reporting & Handoff
- Update `progress.md` with execution status.
- Generate `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, and Verification Method.
- Send confirmation message to parent agent.
